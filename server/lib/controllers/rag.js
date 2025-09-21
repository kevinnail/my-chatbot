import { Router } from 'express';
import multer from 'multer';
import RAG from '../models/RAG.js';
import { getEmbedding } from '../utils/ollamaEmbed.js';
import { recursiveChunk } from '../utils/textChunking.js';
import { chunkCodeFile } from '../utils/codeChunking.js';
import { countTokens } from './chat.js';
import { pool } from '../utils/db.js';
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
  if (['.md'].includes(ext)) return 'markdown';
  if (['.txt', '.doc', '.docx'].includes(ext)) return 'text';
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

    let totalChunks = 0;

    for (const file of files) {
      console.info(`Processing file: ${file.originalname}`);

      // Skip binary/problematic file types
      const skipExtensions = [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.bmp',
        '.ico',
        '.svg',
        '.webp',
        '.mp4',
        '.avi',
        '.mov',
        '.wmv',
        '.flv',
        '.webm',
        '.mp3',
        '.wav',
        '.flac',
        '.aac',
        '.ogg',
        '.zip',
        '.rar',
        '.7z',
        '.tar',
        '.gz',
        '.exe',
        '.dll',
        '.so',
        '.dylib',
        '.bin',
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.ppt',
        '.pptx',
      ];

      const ext = path.extname(file.originalname).toLowerCase();
      if (skipExtensions.includes(ext)) {
        console.info(`⚠️ Skipping binary file: ${file.originalname}`);
        continue;
      }

      // Convert buffer to string
      const content = file.buffer.toString('utf-8');
      const fileType = getFileType(file.originalname);

      // Use transaction for file and chunk operations
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Create file record first
        const fileResult = await RAG.insertFile({ userId, filename: file.originalname, fileType });
        const fileId = fileResult.id;

        let chunks;
        if (fileType === 'code' || fileType === 'markdown') {
          // Use tree-sitter for code files and hybrid chunking for markdown
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
          await RAG.insertFileChunk({
            fileId,
            userId,
            chunkIndex: i,
            content: chunkContent,
            embedding,
            chunkType: chunk.type || 'paragraph',
            tokenCount,
            startLine: chunk.startLine || null,
            endLine: chunk.endLine || null,
          });

          totalChunks++;
        }

        // Update file with total chunk count
        await RAG.updateFileChunkCount({ fileId, totalChunks: chunks.length });

        await client.query('COMMIT');
        console.info(`✅ Stored ${chunks.length} chunks for file: ${file.originalname}`);
      } catch (fileError) {
        await client.query('ROLLBACK');
        console.error(`Error processing file ${file.originalname}:`, fileError);
        throw fileError;
      } finally {
        client.release();
      }
    }

    console.info(`✅ Successfully processed ${files.length} files into ${totalChunks} chunks`);

    res.json({
      message: `Successfully processed ${files.length} files into ${totalChunks} chunks`,
      filesProcessed: files.length,
      totalChunks,
    });
  } catch (error) {
    console.error('Error processing files:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/rag/files/:userId - Retrieve and log stored files with chunk info
router.get('/files/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const files = await RAG.getFilesByUserId(userId);

    console.info(`📁 Found ${files.length} files for user ${userId}:`);
    files.forEach((row, index) => {
      console.info(
        `  ${index + 1}. ${row.filename} (${row.file_type}): ${row.actual_chunks} chunks, ${row.total_tokens || 'unknown'} tokens, Created: ${row.created_at}`,
      );
    });

    res.json({
      message: `Found ${files.length} files`,
      files,
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
    const result = await RAG.getRelevantChunks({ queryEmbedding, userId, limit: limit * 2 }); // Get more candidates for budget selection

    // Convert results and apply similarity filtering
    const candidateChunks = result
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
      console.log('No semantic matches found, trying keyword fallback...');
      const keywordResult = await RAG.getKeywordChunks({ userId, query, limit });

      const keywordChunks = keywordResult.map((row) => ({
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
      ` RAG retrieval for "${query}": ${selectedChunks.length} chunks, ${usedTokens}/${tokenBudget} tokens`,
      selectedChunks.map(
        (chunk) =>
          `${chunk.similarity.toFixed(3)} (${chunk.filename}:${chunk.chunkType}): "${chunk.content.substring(0, 25)}..."`,
      ),
    );

    return selectedChunks;
  } catch (error) {
    console.error('Error retrieving relevant documents:', error);
    return [];
  }
}

export default router;
