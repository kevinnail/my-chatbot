import { pool } from '../utils/db.js';

export default class RAG {
  static async insertFile({ userId, filename, fileType }) {
    const { rows } = await pool.query(
      'INSERT INTO files (user_id, filename, file_type) VALUES ($1, $2, $3) RETURNING id',
      [userId, filename, fileType],
    );
    return rows[0];
  }

  static async insertFileChunk({
    fileId,
    userId,
    chunkIndex,
    content,
    embedding,
    chunkType,
    tokenCount,
    startLine,
    endLine,
  }) {
    await pool.query(
      `INSERT INTO file_chunks (file_id, user_id, chunk_index, content, embedding, chunk_type, token_count, start_line, end_line)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [fileId, userId, chunkIndex, content, embedding, chunkType, tokenCount, startLine, endLine],
    );
  }

  static async updateFileChunkCount({ fileId, totalChunks }) {
    await pool.query('UPDATE files SET total_chunks = $1 WHERE id = $2', [totalChunks, fileId]);
  }

  static async getFilesByUserId(userId) {
    const { rows } = await pool.query(
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
    return rows;
  }

  static async getFileByName({ userId, filename }) {
    const { rows } = await pool.query(
      'SELECT id, filename, file_type, total_chunks FROM files WHERE user_id = $1 AND filename = $2',
      [userId, filename],
    );
    return rows[0] || null;
  }

  static async getRelevantChunks({ queryEmbedding, userId, limit }) {
    const { rows } = await pool.query(
      `SELECT fc.id, fc.content, fc.chunk_type, fc.token_count, f.filename,
              fc.start_line, fc.end_line, 1 - (fc.embedding <=> $1::vector) as similarity 
       FROM file_chunks fc
       JOIN files f ON fc.file_id = f.id
       WHERE fc.user_id = $2 
       ORDER BY fc.embedding <=> $1::vector
       LIMIT $3`,
      [queryEmbedding, userId, limit],
    );
    return rows;
  }

  static async getKeywordChunks({ userId, query, limit }) {
    const { rows } = await pool.query(
      `SELECT fc.id, fc.content, fc.chunk_type, fc.token_count, f.filename,
              fc.start_line, fc.end_line, 0.1 as similarity 
       FROM file_chunks fc
       JOIN files f ON fc.file_id = f.id
       WHERE fc.user_id = $1 
         AND (LOWER(fc.content) LIKE LOWER($2) OR LOWER(fc.content) LIKE LOWER($3))
       LIMIT $4`,
      [userId, `%${query}%`, `%${query.split(' ').join('%')}%`, limit],
    );
    return rows;
  }
}
