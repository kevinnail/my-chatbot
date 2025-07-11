import setup, { cleanup } from '../../test-setup.js';
import {
  buildPromptWithMemory,
  buildPromptWithMemoryAndTime,
} from '../../lib/utils/buildPrompt.js';
import ChatMemory from '../../lib/models/ChatMemory.js';
import { jest, describe, beforeEach, afterAll, it, expect } from '@jest/globals';

// Mock the ollamaEmbed utility
jest.mock('../../lib/utils/ollamaEmbed.js', () => ({
  getEmbedding: jest.fn().mockResolvedValue(`[${new Array(1024).fill(0.1).join(',')}]`),
}));

describe('buildPrompt utilities', () => {
  beforeEach(async () => {
    await setup();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await cleanup();
  });

  describe('buildPromptWithMemory', () => {
    it('should build prompt with memory messages', async () => {
      const userId = 'test_user_prompt';
      const userInput = 'How do I use React hooks?';

      // Store some messages
      const messages = [
        { userId, role: 'user', content: 'What is React?' },
        {
          userId,
          role: 'bot',
          content: 'React is a JavaScript library for building user interfaces',
        },
        { userId, role: 'user', content: 'How do I create components?' },
        {
          userId,
          role: 'bot',
          content: 'You can create components using function or class syntax',
        },
      ];

      for (const message of messages) {
        await ChatMemory.storeMessage(message);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const prompt = await buildPromptWithMemory({ userId, userInput });

      expect(Array.isArray(prompt)).toBe(true);
      expect(prompt.length).toBeGreaterThan(0);

      // Each message should have role and content
      prompt.forEach((message) => {
        expect(message).toEqual({
          role: expect.stringMatching(/^(user|bot)$/),
          content: expect.any(String),
        });
        // Should not include timestamp
        expect(message).not.toHaveProperty('timestamp');
      });
    });

    it('should return empty array for user with no messages', async () => {
      const prompt = await buildPromptWithMemory({
        userId: 'empty_user',
        userInput: 'test input',
      });

      expect(prompt).toEqual([]);
    });

    it('should handle users with limited message history', async () => {
      const userId = 'test_user_limited';
      const userInput = 'test query';

      // Store only one message
      await ChatMemory.storeMessage({
        userId,
        role: 'user',
        content: 'Single message',
      });

      const prompt = await buildPromptWithMemory({ userId, userInput });

      expect(prompt).toHaveLength(1);
      expect(prompt[0]).toEqual({
        role: 'user',
        content: 'Single message',
      });
    });
  });

  describe('buildPromptWithMemoryAndTime', () => {
    it('should build prompt with memory messages and time context', async () => {
      const userId = 'test_user_time';
      const userInput = 'How do I use React hooks?';

      // Store some messages
      const messages = [
        { userId, role: 'user', content: 'What is React?' },
        { userId, role: 'bot', content: 'React is a JavaScript library' },
      ];

      for (const message of messages) {
        await ChatMemory.storeMessage(message);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const prompt = await buildPromptWithMemoryAndTime({ userId, userInput });

      expect(Array.isArray(prompt)).toBe(true);
      expect(prompt.length).toBeGreaterThan(0);

      // Each message should have role and content with time context
      prompt.forEach((message) => {
        expect(message).toEqual({
          role: expect.stringMatching(/^(user|bot)$/),
          content: expect.any(String),
        });
        // Content should include time context like "[0m ago]" or "[1h ago]"
        expect(message.content).toMatch(/^\[\d+[mh] ago\]/);
      });
    });

    it('should format time context correctly for recent messages', async () => {
      const userId = 'test_user_recent_time';
      const userInput = 'test query';

      // Store a message
      await ChatMemory.storeMessage({
        userId,
        role: 'user',
        content: 'Recent message',
      });

      const prompt = await buildPromptWithMemoryAndTime({ userId, userInput });

      expect(prompt).toHaveLength(1);
      expect(prompt[0].content).toMatch(/^\[0m ago\] Recent message$/);
    });

    it('should return empty array for user with no messages', async () => {
      const prompt = await buildPromptWithMemoryAndTime({
        userId: 'empty_user',
        userInput: 'test input',
      });

      expect(prompt).toEqual([]);
    });
  });

  describe('integration with ChatMemory', () => {
    it('should respect hybrid message limits', async () => {
      const userId = 'test_user_integration';
      const userInput = 'React hooks question';

      // Store many messages to test limits
      const messages = [];
      for (let i = 0; i < 10; i++) {
        messages.push({ userId, role: 'user', content: `Message ${i}` });
        messages.push({ userId, role: 'bot', content: `Response ${i}` });
      }

      for (const message of messages) {
        await ChatMemory.storeMessage(message);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const prompt = await buildPromptWithMemory({ userId, userInput });

      // Should not exceed the combined limits from getHybridMessages
      // (relevantLimit: 3, recentLimit: 5, but deduplicated)
      expect(prompt.length).toBeLessThanOrEqual(8);
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should maintain chronological order from ChatMemory', async () => {
      const userId = 'test_user_chronological';
      const userInput = 'test query';

      // Store messages with known order
      const messages = [
        { userId, role: 'user', content: 'First message' },
        { userId, role: 'bot', content: 'First response' },
        { userId, role: 'user', content: 'Second message' },
        { userId, role: 'bot', content: 'Second response' },
      ];

      for (const message of messages) {
        await ChatMemory.storeMessage(message);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      const prompt = await buildPromptWithMemory({ userId, userInput });

      // Should maintain chronological order
      expect(prompt[0].content).toBe('First message');
      expect(prompt[1].content).toBe('First response');
      if (prompt.length > 2) {
        expect(prompt[2].content).toBe('Second message');
      }
      if (prompt.length > 3) {
        expect(prompt[3].content).toBe('Second response');
      }
    });
  });
});
