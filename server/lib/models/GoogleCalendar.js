import { pool } from '../utils/db.js';

class GoogleCalendar {
  static async hasValidTokens(userId) {
    try {
      const { rows } = await pool.query(
        `
        SELECT access_token, refresh_token, expires_at
        FROM google_calendar_tokens
        WHERE user_id = $1
      `,
        [userId],
      );

      if (rows.length === 0) {
        return false;
      }

      const { access_token, refresh_token, expires_at } = rows[0];

      // Check if we have the required tokens
      if (!access_token || !refresh_token) {
        return false;
      }

      // Check if token is still valid (with some buffer time)
      const now = new Date();
      const expiryTime = new Date(expires_at);
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

      return expiryTime.getTime() > now.getTime() + bufferTime;
    } catch (error) {
      console.error('Error checking Google Calendar tokens:', error);
      return false;
    }
  }

  static async getTokens(userId) {
    try {
      const { rows } = await pool.query(
        `
        SELECT access_token, refresh_token, expires_at
        FROM google_calendar_tokens
        WHERE user_id = $1
      `,
        [userId],
      );

      if (rows.length === 0) {
        throw new Error('No Google Calendar tokens found for user');
      }

      const { access_token, refresh_token, expires_at } = rows[0];

      return {
        access_token,
        refresh_token,
        expiry_date: new Date(expires_at).getTime(),
      };
    } catch (error) {
      console.error('Error retrieving Google Calendar tokens:', error);
      throw error;
    }
  }

  static async storeTokens(userId, tokens) {
    try {
      const { access_token, refresh_token, expiry_date } = tokens;
      const expiresAt = new Date(expiry_date);

      await pool.query(
        `
        INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          updated_at = CURRENT_TIMESTAMP
      `,
        [userId, access_token, refresh_token, expiresAt],
      );
    } catch (error) {
      console.error('Error storing Google Calendar tokens:', error);
      throw error;
    }
  }

  static async deleteTokens(userId) {
    try {
      await pool.query(
        `
        DELETE FROM google_calendar_tokens
        WHERE user_id = $1
      `,
        [userId],
      );
    } catch (error) {
      console.error('Error deleting Google Calendar tokens:', error);
      throw error;
    }
  }
}

export default GoogleCalendar;
