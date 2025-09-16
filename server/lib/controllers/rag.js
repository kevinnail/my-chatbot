import { Router } from 'express';
import multer from 'multer';
import { pool } from '../utils/db.js';
import { getEmbedding } from '../utils/ollamaEmbed.js';
import { recursiveChunk } from '../utils/textChunking.js';
import { chunkCodeFile } from '../utils/codeChunking.js';
import { countTokens } from './chat.js';
import path from 'path';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
});

// Helper function to determine file type and choose appropriate chunking strategy
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return 'code';
  if (['.md', '.txt', '.doc', '.docx'].includes(ext)) return 'text';
  return 'text'; // Default to text chunking
}

// POST /api/rag/process-folder - Upload and process files with smart chunking
router.post('/process-folder', upload.array('files'), async (req, res) => {
  try {
    const { userId } = req.body;
    const files = req.files;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    console.info(`Processing ${files.length} files for user ${userId}`);

    const client = await pool.connect();
    let totalChunks = 0;

    try {
      await client.query('BEGIN');

      for (const file of files) {
        console.info(`Processing file: ${file.originalname}`);

        // Convert buffer to string
        const content = file.buffer.toString('utf-8');
        const fileType = getFileType(file.originalname);

        // DEBUG: Log content length and preview
        // eslint-disable-next-line no-console
        console.log(`File: ${file.originalname}`);
        // eslint-disable-next-line no-console
        console.log(`Original content length: ${content.length} characters`);
        // eslint-disable-next-line no-console
        console.log(`File type: ${fileType}`);

        // Create file record first
        const fileResult = await client.query(
          'INSERT INTO files (user_id, filename, file_type) VALUES ($1, $2, $3) RETURNING id',
          [userId, file.originalname, fileType],
        );
        const fileId = fileResult.rows[0].id;

        let chunks;
        if (fileType === 'code') {
          // Use tree-sitter for code files
          chunks = chunkCodeFile(file.originalname, content);
        } else {
          // Use recursive chunking for text files
          const textChunks = recursiveChunk(content, 512); // 512 token chunks
          chunks = textChunks.map((chunk) => ({
            content: chunk,
            type: 'paragraph',
            startLine: null,
            endLine: null,
          }));
        }

        console.info(`Generated ${chunks.length} chunks for ${file.originalname}`);

        // Log chunk sizes for verification
        chunks.forEach((chunk, i) => {
          // eslint-disable-next-line no-console
          console.log(
            `Chunk ${i}: ${chunk.content.length} chars - "${chunk.content.substring(0, 100)}..."`,
          );
        });

        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkContent = chunk.content;
          const tokenCount = countTokens([{ content: chunkContent }]);

          // Generate embedding for chunk
          const embedding = await getEmbedding(chunkContent);

          // Store chunk in database
          await client.query(
            `INSERT INTO file_chunks (file_id, user_id, chunk_index, content, embedding, chunk_type, token_count, start_line, end_line)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              fileId,
              userId,
              i,
              chunkContent,
              embedding,
              chunk.type || 'paragraph',
              tokenCount,
              chunk.startLine || null,
              chunk.endLine || null,
            ],
          );

          totalChunks++;
        }

        // Update file with total chunk count
        await client.query('UPDATE files SET total_chunks = $1 WHERE id = $2', [
          chunks.length,
          fileId,
        ]);

        console.info(`✅ Stored ${chunks.length} chunks for file: ${file.originalname}`);
      }

      await client.query('COMMIT');
      console.info(`✅ Successfully processed ${files.length} files into ${totalChunks} chunks`);

      res.json({
        message: `Successfully processed ${files.length} files into ${totalChunks} chunks`,
        filesProcessed: files.length,
        totalChunks,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error processing files:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/rag/files/:userId - Retrieve and log stored files with chunk info
router.get('/files/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT f.id, f.user_id, f.filename, f.file_type, f.total_chunks, f.created_at,
              COUNT(fc.id) as actual_chunks,
              SUM(fc.token_count) as total_tokens
       FROM files f
       LEFT JOIN file_chunks fc ON f.id = fc.file_id
       WHERE f.user_id = $1 
       GROUP BY f.id, f.user_id, f.filename, f.file_type, f.total_chunks, f.created_at
       ORDER BY f.created_at DESC`,
      [userId],
    );

    console.info(`📁 Found ${result.rows.length} files for user ${userId}:`);
    result.rows.forEach((row, index) => {
      console.info(
        `  ${index + 1}. ${row.filename} (${row.file_type}): ${row.actual_chunks} chunks, ${row.total_tokens || 'unknown'} tokens, Created: ${row.created_at}`,
      );
    });

    res.json({
      message: `Found ${result.rows.length} files`,
      files: result.rows,
    });
  } catch (error) {
    console.error('Error retrieving files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Function to retrieve relevant document chunks based on query embedding
export async function retrieveRelevantDocuments(userId, query, limit = 5, tokenBudget = 2000) {
  try {
    // Generate embedding for the user query
    const queryEmbedding = await getEmbedding(query);

    // Use PostgreSQL's vector similarity search with cosine distance on chunks
    const result = await pool.query(
      `SELECT fc.id, fc.content, fc.chunk_type, fc.token_count, f.filename,
              fc.start_line, fc.end_line, 1 - (fc.embedding <=> $1::vector) as similarity 
       FROM file_chunks fc
       JOIN files f ON fc.file_id = f.id
       WHERE fc.user_id = $2 
       ORDER BY fc.embedding <=> $1::vector
       LIMIT $3`,
      [queryEmbedding, userId, limit * 2], // Get more candidates for budget selection
    );

    // Convert results and apply similarity filtering
    const candidateChunks = result.rows
      .map((row) => ({
        id: row.id,
        content: row.content,
        chunkType: row.chunk_type,
        tokenCount: row.token_count || countTokens([{ content: row.content }]),
        filename: row.filename,
        startLine: row.start_line,
        endLine: row.end_line,
        similarity: parseFloat(row.similarity),
      }))
      .filter((doc) => doc.similarity > 0.5) // Filter by similarity threshold
      .sort((a, b) => b.similarity - a.similarity); // Sort by relevance

    // Budget-based selection - prioritize most relevant chunks within token budget
    const selectedChunks = [];
    let usedTokens = 0;

    for (const chunk of candidateChunks) {
      if (usedTokens + chunk.tokenCount <= tokenBudget && selectedChunks.length < limit) {
        selectedChunks.push(chunk);
        usedTokens += chunk.tokenCount;
      }
    }

    // If no good semantic matches, try simple keyword matching as fallback
    if (selectedChunks.length === 0) {
      // eslint-disable-next-line no-console
      console.log('🔄 No semantic matches found, trying keyword fallback...');
      const keywordResult = await pool.query(
        `SELECT fc.id, fc.content, fc.chunk_type, fc.token_count, f.filename,
                fc.start_line, fc.end_line, 0.1 as similarity 
         FROM file_chunks fc
         JOIN files f ON fc.file_id = f.id
         WHERE fc.user_id = $1 
           AND (LOWER(fc.content) LIKE LOWER($2) OR LOWER(fc.content) LIKE LOWER($3))
         LIMIT $4`,
        [userId, `%${query}%`, `%${query.split(' ').join('%')}%`, limit],
      );

      const keywordChunks = keywordResult.rows.map((row) => ({
        id: row.id,
        content: row.content,
        chunkType: row.chunk_type,
        tokenCount: row.token_count || countTokens([{ content: row.content }]),
        filename: row.filename,
        startLine: row.start_line,
        endLine: row.end_line,
        similarity: parseFloat(row.similarity),
      }));

      // Apply same budget logic to keyword results
      for (const chunk of keywordChunks) {
        if (usedTokens + chunk.tokenCount <= tokenBudget && selectedChunks.length < limit) {
          selectedChunks.push(chunk);
          usedTokens += chunk.tokenCount;
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `📊 RAG retrieval for "${query}": ${selectedChunks.length} chunks, ${usedTokens}/${tokenBudget} tokens`,
      selectedChunks.map(
        (chunk) =>
          `${chunk.similarity.toFixed(3)} (${chunk.filename}:${chunk.chunkType}): "${chunk.content.substring(0, 50)}..."`,
      ),
    );

    return selectedChunks;
  } catch (error) {
    console.error('Error retrieving relevant documents:', error);
    return [];
  }
}

export default router;
