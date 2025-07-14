import { pool } from '../utils/db.js';

class GmailSync {
  // Get last sync time for a user
  static async getLastSyncTime(userId) {
    const result = await pool.query('SELECT last_sync FROM gmail_sync_status WHERE user_id = $1', [
      userId,
    ]);
    return result.rows[0]?.last_sync;
  }

  // Update last sync time for a user
  static async updateLastSyncTime(userId) {
    const result = await pool.query(
      `INSERT INTO gmail_sync_status (user_id, last_sync) 
       VALUES ($1, NOW()) 
       ON CONFLICT (user_id) DO UPDATE SET last_sync = NOW()
       RETURNING last_sync`,
      [userId],
    );
    return result.rows[0]?.last_sync;
  }

  // Initialize sync status for a user
  static async initializeSyncStatus(userId) {
    const result = await pool.query(
      `INSERT INTO gmail_sync_status (user_id, last_sync) 
       VALUES ($1, NOW()) 
       ON CONFLICT (user_id) DO UPDATE SET last_sync = NOW()
       RETURNING *`,
      [userId],
    );
    return result.rows[0];
  }

  // Get sync status for a user
  static async getSyncStatus(userId) {
    const result = await pool.query('SELECT * FROM gmail_sync_status WHERE user_id = $1', [userId]);
    return result.rows[0];
  }

  // Delete sync status for a user
  static async deleteSyncStatus(userId) {
    const result = await pool.query(
      'DELETE FROM gmail_sync_status WHERE user_id = $1 RETURNING *',
      [userId],
    );
    return result.rows[0];
  }
}

export default GmailSync;
