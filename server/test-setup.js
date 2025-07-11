import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.PG_DATABASE = 'chatbot_test'; // Force test database
process.env.OLLAMA_URL = 'http://localhost:11434';
process.env.OLLAMA_MODEL = 'llama2';

// Create test database pool
const testPool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: 'chatbot_test', // Always use test database
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  ssl: false
});

const setup = async () => {
  try {
    // Read and execute the SQL setup file before each test
    // This drops and recreates all tables with fresh data
    const sql = fs.readFileSync('./sql/setup.sql', 'utf-8');
    await testPool.query(sql);
  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
};

// Cleanup function for tests
export const cleanup = async () => {
  await testPool.end();
};

export default setup;
export { testPool as pool }; 