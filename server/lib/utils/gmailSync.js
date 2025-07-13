import { pool } from './db.js';

// Get last sync time
export async function getLastSyncTime(userId) {
  const result = await pool.query('SELECT last_sync FROM gmail_sync_status WHERE user_id = $1', [
    userId,
  ]);

  return result.rows[0]?.last_sync;
}

// Update last sync time
export async function updateLastSyncTime(userId) {
  await pool.query(
    `INSERT INTO gmail_sync_status (user_id, last_sync) 
     VALUES ($1, NOW()) 
     ON CONFLICT (user_id) DO UPDATE SET last_sync = NOW()`,
    [userId],
  );
}
