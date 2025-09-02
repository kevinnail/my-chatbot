import setup, { pool, cleanup } from '../../test-setup.js';
import GmailSync from '../../lib/models/GmailSync.js';
import { jest, describe, beforeEach, afterAll, it, expect } from '@jest/globals';

describe('GmailSync model', () => {
  beforeEach(async () => {
    await setup();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await cleanup();
  });

  describe('getLastSyncTime', () => {
    it('should return null for user with no sync history', async () => {
      const lastSync = await GmailSync.getLastSyncTime('new_user');
      expect(lastSync).toBeNull();
    });

    it('should return last sync time for existing user', async () => {
      const userId = 'test_user_sync';

      // Initialize sync status
      await GmailSync.initializeSyncStatus(userId);

      const lastSync = await GmailSync.getLastSyncTime(userId);
      expect(lastSync).toBeInstanceOf(Date);
    });
  });

  describe('updateLastSyncTime', () => {
    it('should create new sync record for new user', async () => {
      const userId = 'test_user_new_sync';

      const result = await GmailSync.updateLastSyncTime(userId);

      expect(result).toBeInstanceOf(Date);

      // Verify record was created
      const { rows } = await pool.query('SELECT * FROM gmail_sync_status WHERE user_id = $1', [
        userId,
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBe(userId);
      expect(rows[0].last_sync).toBeInstanceOf(Date);
    });

    it('should update existing sync record', async () => {
      const userId = 'test_user_update_sync';

      // Create initial record
      await GmailSync.initializeSyncStatus(userId);
      const initialSync = await GmailSync.getLastSyncTime(userId);

      // Wait a moment to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update sync time
      const updatedSync = await GmailSync.updateLastSyncTime(userId);

      expect(updatedSync).toBeInstanceOf(Date);
      expect(updatedSync.getTime()).toBeGreaterThan(initialSync.getTime());

      // Verify only one record exists
      const { rows } = await pool.query('SELECT * FROM gmail_sync_status WHERE user_id = $1', [
        userId,
      ]);
      expect(rows).toHaveLength(1);
    });
  });

  describe('initializeSyncStatus', () => {
    it('should create new sync status for new user', async () => {
      const userId = 'test_user_initialize';

      const result = await GmailSync.initializeSyncStatus(userId);

      expect(result).toHaveProperty('user_id', userId);
      expect(result).toHaveProperty('last_sync');
      expect(result.last_sync).toBeInstanceOf(Date);

      // Verify database record
      const { rows } = await pool.query('SELECT * FROM gmail_sync_status WHERE user_id = $1', [
        userId,
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBe(userId);
    });

    it('should update existing sync status', async () => {
      const userId = 'test_user_reinitialize';

      // Create initial record
      const initialResult = await GmailSync.initializeSyncStatus(userId);
      const initialTime = initialResult.last_sync;

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Initialize again
      const updatedResult = await GmailSync.initializeSyncStatus(userId);

      expect(updatedResult.user_id).toBe(userId);
      expect(updatedResult.last_sync.getTime()).toBeGreaterThan(initialTime.getTime());

      // Verify still only one record
      const { rows } = await pool.query('SELECT * FROM gmail_sync_status WHERE user_id = $1', [
        userId,
      ]);
      expect(rows).toHaveLength(1);
    });
  });

  describe('getSyncStatus', () => {
    it('should return null for non-existent user', async () => {
      const status = await GmailSync.getSyncStatus('non_existent_user');
      expect(status).toBeUndefined();
    });

    it('should return complete sync status for existing user', async () => {
      const userId = 'test_user_get_status';

      // Initialize sync status
      const initialized = await GmailSync.initializeSyncStatus(userId);

      const status = await GmailSync.getSyncStatus(userId);

      expect(status).toHaveProperty('user_id', userId);
      expect(status).toHaveProperty('last_sync');
      expect(status.last_sync).toBeInstanceOf(Date);
      expect(status.last_sync.getTime()).toBe(initialized.last_sync.getTime());
    });
  });

  describe('deleteSyncStatus', () => {
    it('should delete sync status for existing user', async () => {
      const userId = 'test_user_delete';

      // Create sync status
      await GmailSync.initializeSyncStatus(userId);

      // Verify it exists
      let status = await GmailSync.getSyncStatus(userId);
      expect(status).toBeDefined();

      // Delete it
      const deletedRecord = await GmailSync.deleteSyncStatus(userId);

      expect(deletedRecord).toHaveProperty('user_id', userId);
      expect(deletedRecord).toHaveProperty('last_sync');

      // Verify it's gone
      status = await GmailSync.getSyncStatus(userId);
      expect(status).toBeUndefined();

      // Verify database record is gone
      const { rows } = await pool.query('SELECT * FROM gmail_sync_status WHERE user_id = $1', [
        userId,
      ]);
      expect(rows).toHaveLength(0);
    });

    it('should return undefined when deleting non-existent user', async () => {
      const deletedRecord = await GmailSync.deleteSyncStatus('non_existent_user');
      expect(deletedRecord).toBeUndefined();
    });

    it('should not affect other users when deleting', async () => {
      const userId1 = 'test_user_delete_1';
      const userId2 = 'test_user_delete_2';

      // Create sync status for both users
      await GmailSync.initializeSyncStatus(userId1);
      await GmailSync.initializeSyncStatus(userId2);

      // Delete first user
      await GmailSync.deleteSyncStatus(userId1);

      // Verify first user is gone, second user remains
      const status1 = await GmailSync.getSyncStatus(userId1);
      const status2 = await GmailSync.getSyncStatus(userId2);

      expect(status1).toBeUndefined();
      expect(status2).toBeDefined();
      expect(status2.user_id).toBe(userId2);
    });
  });

  describe('integration tests', () => {
    it('should handle complete sync workflow', async () => {
      const userId = 'test_user_workflow';

      // 1. Check initial state (no sync history)
      let lastSync = await GmailSync.getLastSyncTime(userId);
      expect(lastSync).toBeNull();

      // 2. Initialize sync status
      const initialized = await GmailSync.initializeSyncStatus(userId);
      expect(initialized).toHaveProperty('user_id', userId);
      expect(initialized.last_sync).toBeInstanceOf(Date);

      // 3. Get last sync time
      lastSync = await GmailSync.getLastSyncTime(userId);
      expect(lastSync).toBeInstanceOf(Date);
      expect(lastSync.getTime()).toBe(initialized.last_sync.getTime());

      // 4. Update sync time
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = await GmailSync.updateLastSyncTime(userId);
      expect(updated.getTime()).toBeGreaterThan(lastSync.getTime());

      // 5. Get complete status
      const status = await GmailSync.getSyncStatus(userId);
      expect(status.user_id).toBe(userId);
      expect(status.last_sync.getTime()).toBe(updated.getTime());

      // 6. Clean up
      const deleted = await GmailSync.deleteSyncStatus(userId);
      expect(deleted.user_id).toBe(userId);

      // 7. Verify cleanup
      const finalStatus = await GmailSync.getSyncStatus(userId);
      expect(finalStatus).toBeUndefined();
    });
  });
});
