import { pool } from '../utils/db.js';
import { getEmbedding } from '../utils/ollamaEmbed.js'

export async function storeMessage({ userId, role, content }) {
  const embedding = await getEmbedding(content);

  await pool.query(`
    INSERT INTO chat_memory (user_id, role, content, embedding)
    VALUES ($1, $2, $3, $4)
  `, [userId, role, content, embedding]);
}

export async function getRelevantMessages({ userId, inputText, limit = 5 }) {
  const queryEmbedding = await getEmbedding(inputText);

  const { rows } = await pool.query(`
    SELECT role, content
    FROM chat_memory
    WHERE user_id = $1
    ORDER BY embedding <-> $2
    LIMIT $3
  `, [userId, queryEmbedding, limit]);

  return rows.map(({ role, content }) => ({ role, content }));
}
