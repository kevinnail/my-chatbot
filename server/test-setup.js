import { pool } from './lib/utils/db.js';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.PG_USER = 'postgres';
process.env.PG_HOST = 'localhost';
process.env.PG_DATABASE = 'chatbot_test';
process.env.PG_PASSWORD = 'password';
process.env.PG_PORT = '5432';
process.env.OLLAMA_URL = 'http://localhost:11434';
process.env.OLLAMA_MODEL = 'llama2';

const setup = async () => {
  // Create test database tables if they don't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_memory (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      embedding VECTOR(1024),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Clear test data
  await pool.query('DELETE FROM chat_memory WHERE user_id LIKE $1', ['test_%']);
};

export default setup; 