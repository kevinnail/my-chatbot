import setup, { pool, cleanup } from '../../test-setup.js';
import GoogleCalendar from '../../lib/models/GoogleCalendar.js';
import { jest, describe, beforeEach, afterAll, it, expect } from '@jest/globals';

describe('GoogleCalendar model', () => {
  beforeEach(async () => {
    await setup();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await cleanup();
  });

  describe('hasValidTokens', () => {
    it('should return false for user with no tokens', async () => {
      const hasTokens = await GoogleCalendar.hasValidTokens('non_existent_user');
      expect(hasTokens).toBe(false);
    });

    it('should return false for user with missing refresh token', async () => {
      const userId = 'test_user_missing_refresh';
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

      await pool.query(
        'INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expires_at) VALUES ($1, $2, $3, $4)',
        [userId, 'access_token', null, futureDate],
      );

      const hasTokens = await GoogleCalendar.hasValidTokens(userId);
      expect(hasTokens).toBe(false);
    });

    it('should return false for expired tokens', async () => {
      const userId = 'test_user_expired';
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago

      await pool.query(
        'INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expires_at) VALUES ($1, $2, $3, $4)',
        [userId, 'access_token', 'refresh_token', pastDate],
      );

      const hasTokens = await GoogleCalendar.hasValidTokens(userId);
      expect(hasTokens).toBe(false);
    });

    it('should return false for tokens expiring within buffer time', async () => {
      const userId = 'test_user_buffer';
      const nearFutureDate = new Date(Date.now() + 60000); // 1 minute from now (within 5-minute buffer)

      await pool.query(
        'INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expires_at) VALUES ($1, $2, $3, $4)',
        [userId, 'access_token', 'refresh_token', nearFutureDate],
      );

      const hasTokens = await GoogleCalendar.hasValidTokens(userId);
      expect(hasTokens).toBe(false);
    });

    it('should return true for valid tokens', async () => {
      const userId = 'test_user_valid';
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

      await pool.query(
        'INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expires_at) VALUES ($1, $2, $3, $4)',
        [userId, 'valid_access_token', 'valid_refresh_token', futureDate],
      );

      const hasTokens = await GoogleCalendar.hasValidTokens(userId);
      expect(hasTokens).toBe(true);
    });
  });

  describe('getTokens', () => {
    it('should throw error for user with no tokens', async () => {
      await expect(GoogleCalendar.getTokens('non_existent_user')).rejects.toThrow(
        'No Google Calendar tokens found for user',
      );
    });

    it('should return tokens for existing user', async () => {
      const userId = 'test_user_get_tokens';
      const accessToken = 'test_access_token';
      const refreshToken = 'test_refresh_token';
      const expiryDate = new Date(Date.now() + 3600000); // 1 hour from now

      await pool.query(
        'INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expires_at) VALUES ($1, $2, $3, $4)',
        [userId, accessToken, refreshToken, expiryDate],
      );

      const tokens = await GoogleCalendar.getTokens(userId);

      expect(tokens).toEqual({
        access_token: accessToken,
        refresh_token: refreshToken,
        expiry_date: expiryDate.getTime(),
      });
    });
  });

  describe('storeTokens', () => {
    it('should store new tokens for new user', async () => {
      const userId = 'test_user_store_new';
      const tokens = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expiry_date: Date.now() + 3600000, // 1 hour from now
      };

      await GoogleCalendar.storeTokens(userId, tokens);

      const { rows } = await pool.query('SELECT * FROM google_calendar_tokens WHERE user_id = $1', [
        userId,
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      expect(new Date(rows[0].expires_at).getTime()).toBe(tokens.expiry_date);
    });

    it('should update existing tokens for existing user', async () => {
      const userId = 'test_user_store_update';
      const initialTokens = {
        access_token: 'initial_access_token',
        refresh_token: 'initial_refresh_token',
        expiry_date: Date.now() + 1800000, // 30 minutes from now
      };

      const updatedTokens = {
        access_token: 'updated_access_token',
        refresh_token: 'updated_refresh_token',
        expiry_date: Date.now() + 7200000, // 2 hours from now
      };

      // Store initial tokens
      await GoogleCalendar.storeTokens(userId, initialTokens);

      // Update with new tokens
      await GoogleCalendar.storeTokens(userId, updatedTokens);

      const { rows } = await pool.query('SELECT * FROM google_calendar_tokens WHERE user_id = $1', [
        userId,
      ]);

      // Should still have only one record
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        user_id: userId,
        access_token: updatedTokens.access_token,
        refresh_token: updatedTokens.refresh_token,
      });
      expect(new Date(rows[0].expires_at).getTime()).toBe(updatedTokens.expiry_date);
    });

    it('should handle Date object for expiry_date', async () => {
      const userId = 'test_user_store_date';
      const expiryDate = new Date(Date.now() + 3600000);
      const tokens = {
        access_token: 'date_access_token',
        refresh_token: 'date_refresh_token',
        expiry_date: expiryDate.getTime(),
      };

      await GoogleCalendar.storeTokens(userId, tokens);

      const { rows } = await pool.query('SELECT * FROM google_calendar_tokens WHERE user_id = $1', [
        userId,
      ]);

      expect(rows).toHaveLength(1);
      expect(new Date(rows[0].expires_at).getTime()).toBe(expiryDate.getTime());
    });
  });

  describe('deleteTokens', () => {
    it('should delete tokens for existing user', async () => {
      const userId = 'test_user_delete';
      const tokens = {
        access_token: 'delete_access_token',
        refresh_token: 'delete_refresh_token',
        expiry_date: Date.now() + 3600000,
      };

      // Store tokens
      await GoogleCalendar.storeTokens(userId, tokens);

      // Verify tokens exist
      let { rows } = await pool.query('SELECT * FROM google_calendar_tokens WHERE user_id = $1', [
        userId,
      ]);
      expect(rows).toHaveLength(1);

      // Delete tokens
      await GoogleCalendar.deleteTokens(userId);

      // Verify tokens are gone
      ({ rows } = await pool.query('SELECT * FROM google_calendar_tokens WHERE user_id = $1', [
        userId,
      ]));
      expect(rows).toHaveLength(0);
    });

    it('should not throw error when deleting non-existent tokens', async () => {
      await expect(GoogleCalendar.deleteTokens('non_existent_user')).resolves.not.toThrow();
    });

    it('should not affect other users when deleting tokens', async () => {
      const userId1 = 'test_user_delete_1';
      const userId2 = 'test_user_delete_2';
      const tokens1 = {
        access_token: 'user1_access_token',
        refresh_token: 'user1_refresh_token',
        expiry_date: Date.now() + 3600000,
      };
      const tokens2 = {
        access_token: 'user2_access_token',
        refresh_token: 'user2_refresh_token',
        expiry_date: Date.now() + 3600000,
      };

      // Store tokens for both users
      await GoogleCalendar.storeTokens(userId1, tokens1);
      await GoogleCalendar.storeTokens(userId2, tokens2);

      // Delete tokens for user1
      await GoogleCalendar.deleteTokens(userId1);

      // Verify user1 tokens are gone, user2 tokens remain
      const { rows: rows1 } = await pool.query(
        'SELECT * FROM google_calendar_tokens WHERE user_id = $1',
        [userId1],
      );
      const { rows: rows2 } = await pool.query(
        'SELECT * FROM google_calendar_tokens WHERE user_id = $1',
        [userId2],
      );

      expect(rows1).toHaveLength(0);
      expect(rows2).toHaveLength(1);
      expect(rows2[0].user_id).toBe(userId2);
    });
  });

  describe('integration tests', () => {
    it('should handle complete token lifecycle', async () => {
      const userId = 'test_user_lifecycle';
      const tokens = {
        access_token: 'lifecycle_access_token',
        refresh_token: 'lifecycle_refresh_token',
        expiry_date: Date.now() + 3600000, // 1 hour from now
      };

      // 1. Initially no tokens
      let hasTokens = await GoogleCalendar.hasValidTokens(userId);
      expect(hasTokens).toBe(false);

      await expect(GoogleCalendar.getTokens(userId)).rejects.toThrow(
        'No Google Calendar tokens found for user',
      );

      // 2. Store tokens
      await GoogleCalendar.storeTokens(userId, tokens);

      // 3. Verify tokens are valid
      hasTokens = await GoogleCalendar.hasValidTokens(userId);
      expect(hasTokens).toBe(true);

      // 4. Retrieve tokens
      const retrievedTokens = await GoogleCalendar.getTokens(userId);
      expect(retrievedTokens).toEqual(tokens);

      // 5. Update tokens
      const updatedTokens = {
        access_token: 'updated_lifecycle_access_token',
        refresh_token: 'updated_lifecycle_refresh_token',
        expiry_date: Date.now() + 7200000, // 2 hours from now
      };

      await GoogleCalendar.storeTokens(userId, updatedTokens);

      const newRetrievedTokens = await GoogleCalendar.getTokens(userId);
      expect(newRetrievedTokens).toEqual(updatedTokens);

      // 6. Delete tokens
      await GoogleCalendar.deleteTokens(userId);

      // 7. Verify tokens are gone
      hasTokens = await GoogleCalendar.hasValidTokens(userId);
      expect(hasTokens).toBe(false);

      await expect(GoogleCalendar.getTokens(userId)).rejects.toThrow(
        'No Google Calendar tokens found for user',
      );
    });

    it('should handle expired token scenario', async () => {
      const userId = 'test_user_expired_scenario';
      const expiredTokens = {
        access_token: 'expired_access_token',
        refresh_token: 'expired_refresh_token',
        expiry_date: Date.now() - 3600000, // 1 hour ago
      };

      // Store expired tokens
      await GoogleCalendar.storeTokens(userId, expiredTokens);

      // Should be able to retrieve tokens (they exist)
      const retrievedTokens = await GoogleCalendar.getTokens(userId);
      expect(retrievedTokens).toEqual(expiredTokens);

      // But hasValidTokens should return false
      const hasValidTokens = await GoogleCalendar.hasValidTokens(userId);
      expect(hasValidTokens).toBe(false);
    });
  });
});
