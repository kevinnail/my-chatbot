import 'dotenv/config';
import app from './lib/app.js';

const API_URL = process.env.API_URL || 'http://localhost';
const PORT = process.env.PORT || 7890;

app.listen(PORT, () => {
  console.info(`🚀  Server started on ${API_URL}:${PORT}`);
});

// Placeholder for pool import and graceful shutdown
// import pool from './lib/utils/pool.js';
// process.on('exit', () => {
//   console.info('👋  Goodbye!');
//   pool.end();
// });
