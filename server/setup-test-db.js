import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;

const setupTestDb = async () => {
  // First connect to postgres default database to create test database
  const adminPool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: 'postgres', // Connect to default postgres database
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    ssl: false,
  });

  try {
    console.log('Setting up test database...');

    // Create test database if it doesn't exist
    await adminPool.query('CREATE DATABASE chatbot_test;');
    // eslint-disable-next-line no-console
    console.log('✅ Test database created!');
  } catch (error) {
    if (error.code === '42P04') {
      // eslint-disable-next-line no-console
      console.log('Test database already exists, continuing...');
    } else {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to create test database:', error);
      throw error;
    }
  } finally {
    await adminPool.end();
  }

  // Now connect to the test database and run setup
  const testPool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: 'chatbot_test',
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    ssl: false,
  });

  try {
    // Read and execute the SQL setup file
    const sql = fs.readFileSync('./sql/setup.sql', 'utf-8');
    await testPool.query(sql);

    // eslint-disable-next-line no-console
    console.log('✅ Test database setup complete!');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Test database setup failed:', error);
    throw error;
  } finally {
    await testPool.end();
  }
};

setupTestDb();
