import { Router } from 'express';
import multer from 'multer';
import { pool } from '../utils/db.js';
import { getEmbedding } from '../utils/ollamaEmbed.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
});

// POST /api/rag/process-folder - Upload and process files
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

        // Generate embedding for the full file content
        const embedding = await getEmbedding(content);

        // Store in database
        await client.query('INSERT INTO files (user_id, content, embedding) VALUES ($1, $2, $3)', [
          userId,
          content,
          embedding,
        ]);

        totalChunks++;
        console.info(`✅ Stored file: ${file.originalname}`);
      }

      await client.query('COMMIT');
      console.info(`✅ Successfully processed ${totalChunks} files`);

      res.json({
        message: `Successfully processed ${totalChunks} files`,
        filesProcessed: totalChunks,
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

// GET /api/rag/files/:userId - Retrieve and log stored files
router.get('/files/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT id, user_id, LEFT(content, 100) as content_preview, created_at 
       FROM files 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId],
    );

    console.info(`📁 Found ${result.rows.length} files for user ${userId}:`);
    result.rows.forEach((row, index) => {
      console.info(
        `  ${index + 1}. ID: ${row.id}, Preview: "${row.content_preview}...", Created: ${row.created_at}`,
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

// Function to retrieve relevant documents based on query embedding
export async function retrieveRelevantDocuments(userId, query, limit = 5) {
  try {
    // Generate embedding for the user query
    const queryEmbedding = await getEmbedding(query);

    // Use PostgreSQL's vector similarity search with cosine distance
    const result = await pool.query(
      `SELECT id, content, 1 - (embedding <=> $1::vector) as similarity 
       FROM files 
       WHERE user_id = $2 
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [queryEmbedding, userId, limit],
    );

    // Convert results and apply minimal filtering
    let filteredResults = result.rows
      .map((row) => ({
        id: row.id,
        content: row.content,
        similarity: parseFloat(row.similarity),
      }))
      .filter((doc) => doc.similarity > 0.5); // Very low threshold - almost everything

    // If no good semantic matches, try simple keyword matching as fallback
    if (filteredResults.length === 0) {
      console.log('🔄 No semantic matches found, trying keyword fallback...');
      const keywordResult = await pool.query(
        `SELECT id, content, 0.1 as similarity 
         FROM files 
         WHERE user_id = $1 
           AND (LOWER(content) LIKE LOWER($2) OR LOWER(content) LIKE LOWER($3))
         LIMIT $4`,
        [userId, `%${query}%`, `%${query.split(' ').join('%')}%`, limit],
      );

      filteredResults = keywordResult.rows.map((row) => ({
        id: row.id,
        content: row.content,
        similarity: parseFloat(row.similarity),
      }));
    }

    console.log(
      `📊 Document retrieval results for query "${query}":`,
      filteredResults.map(
        (doc) => `${doc.similarity.toFixed(3)}: "${doc.content.substring(0, 50)}..."`,
      ),
    );

    return filteredResults;
  } catch (error) {
    console.error('Error retrieving relevant documents:', error);
    return [];
  }
}

export default router;
