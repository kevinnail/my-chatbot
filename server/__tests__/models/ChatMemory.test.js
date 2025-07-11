import setup, { pool, cleanup } from '../../test-setup.js';
import ChatMemory from '../../lib/models/ChatMemory.js';
import { jest, describe, beforeEach, afterAll, it, expect } from '@jest/globals';

// Mock the ollamaEmbed utility
jest.mock('../../lib/utils/ollamaEmbed.js', () => ({
  getEmbedding: jest.fn().mockResolvedValue(`[${new Array(1024).fill(0.1).join(',')}]`)
}));

describe('ChatMemory model', () => {
  beforeEach(async () => {
    await setup();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await cleanup();
  });

  describe('storeMessage', () => {
    it('should store a message with embedding', async () => {
      const messageData = {
        userId: 'test_user_store',
        role: 'user',
        content: 'Test message for storage'
      };

      await ChatMemory.storeMessage(messageData);

      const { rows } = await pool.query(
        'SELECT * FROM chat_memory WHERE user_id = $1',
        [messageData.userId]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        id: expect.any(Number),
        user_id: messageData.userId,
        role: messageData.role,
        content: messageData.content,
        embedding: expect.any(String),
        created_at: expect.any(Date)
      });
    });

    it('should store multiple messages for the same user', async () => {
      const userId = 'test_user_multiple';
      const messages = [
        { userId, role: 'user', content: 'First message' },
        { userId, role: 'bot', content: 'First response' },
        { userId, role: 'user', content: 'Second message' }
      ];

      for (const message of messages) {
        await ChatMemory.storeMessage(message);
      }

      const { rows } = await pool.query(
        'SELECT role, content FROM chat_memory WHERE user_id = $1 ORDER BY created_at',
        [userId]
      );

      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual({
        role: 'user',
        content: 'First message'
      });
      expect(rows[1]).toEqual({
        role: 'bot',
        content: 'First response'
      });
      expect(rows[2]).toEqual({
        role: 'user',
        content: 'Second message'
      });
    });
  });

  describe('getRecentMessages', () => {
    it('should return recent messages in chronological order', async () => {
      const userId = 'test_user_recent';
      const messages = [
        { userId, role: 'user', content: 'Message 1' },
        { userId, role: 'bot', content: 'Response 1' },
        { userId, role: 'user', content: 'Message 2' },
        { userId, role: 'bot', content: 'Response 2' }
      ];

      for (const message of messages) {
        await ChatMemory.storeMessage(message);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const recentMessages = await ChatMemory.getRecentMessages({ userId, limit: 3 });

      expect(recentMessages).toHaveLength(3);
      expect(recentMessages[0]).toEqual({
        role: 'bot',
        content: 'Response 1',
        timestamp: expect.any(Date)
      });
      expect(recentMessages[1]).toEqual({
        role: 'user',
        content: 'Message 2',
        timestamp: expect.any(Date)
      });
      expect(recentMessages[2]).toEqual({
        role: 'bot',
        content: 'Response 2',
        timestamp: expect.any(Date)
      });
    });

    it('should respect the limit parameter', async () => {
      const userId = 'test_user_limit';
      const messages = [
        { userId, role: 'user', content: 'Message 1' },
        { userId, role: 'bot', content: 'Response 1' },
        { userId, role: 'user', content: 'Message 2' },
        { userId, role: 'bot', content: 'Response 2' },
        { userId, role: 'user', content: 'Message 3' }
      ];

      for (const message of messages) {
        await ChatMemory.storeMessage(message);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const recentMessages = await ChatMemory.getRecentMessages({ userId, limit: 2 });

      expect(recentMessages).toHaveLength(2);
      expect(recentMessages[0].content).toBe('Response 2');
      expect(recentMessages[1].content).toBe('Message 3');
    });

    it('should return empty array for non-existent user', async () => {
      const recentMessages = await ChatMemory.getRecentMessages({ 
        userId: 'non_existent_user', 
        limit: 5 
      });

      expect(recentMessages).toEqual([]);
    });
  });

  describe('getAllMessages', () => {
    it('should return all messages for a user in chronological order', async () => {
      const userId = 'test_user_all';
      const messages = [
        { userId, role: 'user', content: 'First message' },
        { userId, role: 'bot', content: 'First response' },
        { userId, role: 'user', content: 'Second message' }
      ];

      for (const message of messages) {
        await ChatMemory.storeMessage(message);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const allMessages = await ChatMemory.getAllMessages({ userId });

      expect(allMessages).toHaveLength(3);
      expect(allMessages[0]).toEqual({
        role: 'user',
        content: 'First message'
      });
      expect(allMessages[1]).toEqual({
        role: 'bot',
        content: 'First response'
      });
      expect(allMessages[2]).toEqual({
        role: 'user',
        content: 'Second message'
      });
    });

    it('should return empty array for user with no messages', async () => {
      const allMessages = await ChatMemory.getAllMessages({ userId: 'empty_user' });
      expect(allMessages).toEqual([]);
    });
  });

  describe('deleteUserMessages', () => {
    it('should delete all messages for a specific user', async () => {
      const userId1 = 'test_user_delete_1';
      const userId2 = 'test_user_delete_2';

      // Add messages for both users
      await ChatMemory.storeMessage({ userId: userId1, role: 'user', content: 'User 1 message' });
      await ChatMemory.storeMessage({ userId: userId2, role: 'user', content: 'User 2 message' });

      // Verify both users have messages
      const beforeDelete1 = await ChatMemory.getAllMessages({ userId: userId1 });
      const beforeDelete2 = await ChatMemory.getAllMessages({ userId: userId2 });
      expect(beforeDelete1).toHaveLength(1);
      expect(beforeDelete2).toHaveLength(1);

      // Delete messages for userId1 only
      await ChatMemory.deleteUserMessages({ userId: userId1 });

      // Verify only userId1 messages are deleted
      const afterDelete1 = await ChatMemory.getAllMessages({ userId: userId1 });
      const afterDelete2 = await ChatMemory.getAllMessages({ userId: userId2 });
      expect(afterDelete1).toHaveLength(0);
      expect(afterDelete2).toHaveLength(1);
    });

    it('should handle deletion of non-existent user gracefully', async () => {
      // This should not throw an error
      await expect(ChatMemory.deleteUserMessages({ userId: 'non_existent_user' }))
        .resolves.not.toThrow();
    });
  });

  describe('getMessageCount', () => {
    it('should return correct message count for a user', async () => {
      const userId = 'test_user_count';
      
      // Initially should be 0
      let count = await ChatMemory.getMessageCount(userId);
      expect(count).toBe(0);

      // Add messages
      await ChatMemory.storeMessage({ userId, role: 'user', content: 'Message 1' });
      await ChatMemory.storeMessage({ userId, role: 'bot', content: 'Response 1' });
      await ChatMemory.storeMessage({ userId, role: 'user', content: 'Message 2' });

      // Should now be 3
      count = await ChatMemory.getMessageCount(userId);
      expect(count).toBe(3);
    });

    it('should return 0 for non-existent user', async () => {
      const count = await ChatMemory.getMessageCount('non_existent_user');
      expect(count).toBe(0);
    });
  });

  describe('getRelevantMessages', () => {
    it('should return messages ordered by similarity', async () => {
      const userId = 'test_user_relevant';
      const messages = [
        { userId, role: 'user', content: 'I need help with React hooks' },
        { userId, role: 'bot', content: 'Here is how to use React hooks' },
        { userId, role: 'user', content: 'What about Express middleware?' },
        { userId, role: 'bot', content: 'Express middleware works like this' }
      ];

      for (const message of messages) {
        await ChatMemory.storeMessage(message);
      }

      const relevantMessages = await ChatMemory.getRelevantMessages({ 
        userId, 
        inputText: 'React hooks usage',
        limit: 2 
      });

      expect(relevantMessages).toHaveLength(2);
      expect(relevantMessages[0]).toEqual({
        role: expect.any(String),
        content: expect.any(String),
        timestamp: expect.any(Date)
      });
    });

    it('should return empty array for user with no messages', async () => {
      const relevantMessages = await ChatMemory.getRelevantMessages({ 
        userId: 'empty_user', 
        inputText: 'test query',
        limit: 5 
      });

      expect(relevantMessages).toEqual([]);
    });
  });

  describe('getHybridMessages', () => {
    it('should combine relevant and recent messages without duplicates', async () => {
      const userId = 'test_user_hybrid';
      const messages = [
        { userId, role: 'user', content: 'React hooks question' },
        { userId, role: 'bot', content: 'React hooks answer' },
        { userId, role: 'user', content: 'Express middleware question' },
        { userId, role: 'bot', content: 'Express middleware answer' },
        { userId, role: 'user', content: 'Node.js streams question' }
      ];

      for (const message of messages) {
        await ChatMemory.storeMessage(message);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const hybridMessages = await ChatMemory.getHybridMessages({ 
        userId, 
        inputText: 'React hooks',
        relevantLimit: 2,
        recentLimit: 3
      });

      expect(hybridMessages.length).toBeGreaterThan(0);
      expect(hybridMessages.length).toBeLessThanOrEqual(5);
      
      // Should be sorted by timestamp
      for (let i = 1; i < hybridMessages.length; i++) {
        expect(new Date(hybridMessages[i].timestamp).getTime())
          .toBeGreaterThanOrEqual(new Date(hybridMessages[i - 1].timestamp).getTime());
      }
    });

    it('should return empty array for user with no messages', async () => {
      const hybridMessages = await ChatMemory.getHybridMessages({ 
        userId: 'empty_user', 
        inputText: 'test query',
        relevantLimit: 2,
        recentLimit: 3
      });

      expect(hybridMessages).toEqual([]);
    });
  });
}); 
