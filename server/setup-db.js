import fs from 'fs';
import { pool } from './lib/utils/db.js';

const setup = async () => {
  try {
    console.log('🗄️  Setting up database...');
    
    // Read and execute the SQL setup file
    const sql = fs.readFileSync('./sql/setup.sql', 'utf-8');
    await pool.query(sql);
    
    console.log('✅ Database setup complete!');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

setup(); 