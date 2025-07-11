import setup, { pool, cleanup } from '../../test-setup.js';
import request from 'supertest';
import app from '../../lib/app.js';
import { jest, describe, beforeEach, afterAll, it, expect } from '@jest/globals';

// Mock the external Ollama API
global.fetch = jest.fn();

describe('chat routes', () => {
  beforeEach(async () => {
    await setup();
    // Reset fetch mock before each test
    fetch.mockClear();

    // Mock fetch for embedding API calls
    // eslint-disable-next-line no-unused-vars
    fetch.mockImplementation((url, _options) => {
      if (url.includes('/api/embed')) {
        // Mock embedding API response
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              embeddings: [new Array(1024).fill(0.1)],
            }),
        });
      }

      // Mock Ollama chat API response (will be overridden by specific tests)
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            message: { content: 'Default test response' },
            prompt_eval_count: 100,
          }),
      });
    });
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await cleanup();
  });

  describe('POST /api/chat', () => {
    it('should send a message and receive a bot response', async () => {
      // Mock Ollama API response
      const mockOllamaResponse = {
        message: {
          content:
            "Hello! I'm a senior software engineer. How can I help you with your React, Express, or Node.js questions?",
        },
        prompt_eval_count: 150,
      };

      // Override the default fetch mock for this test
      // eslint-disable-next-line no-unused-vars
      fetch.mockImplementation((url, _options) => {
        if (url.includes('/api/embed')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                embeddings: [new Array(1024).fill(0.1)],
              }),
          });
        }

        if (url.includes('/api/chat')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOllamaResponse),
          });
        }

        return Promise.reject(new Error('Unexpected API call'));
      });

      const testMessage = {
        msg: 'Hello, I need help with React hooks',
        userId: 'test_user_1',
      };

      const response = await request(app).post('/api/chat').send(testMessage);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        bot: expect.any(String),
        prompt_eval_count: expect.any(Number),
        context_percent: expect.any(String),
      });

      expect(response.body.bot).toBe(mockOllamaResponse.message.content);
      expect(response.body.prompt_eval_count).toBe(150);
      expect(parseFloat(response.body.context_percent)).toBeGreaterThanOrEqual(0);

      // Verify the message was stored in the database
      const { rows } = await pool.query(
        'SELECT * FROM chat_memory WHERE user_id = $1 ORDER BY created_at',
        ['test_user_1'],
      );

      expect(rows).toHaveLength(2); // user message + bot response
      expect(rows[0]).toEqual({
        id: expect.any(Number),
        user_id: 'test_user_1',
        role: 'user',
        content: 'Hello, I need help with React hooks',
        embedding: expect.any(String),
        created_at: expect.any(Date),
      });
      expect(rows[1]).toEqual({
        id: expect.any(Number),
        user_id: 'test_user_1',
        role: 'bot',
        content: mockOllamaResponse.message.content,
        embedding: expect.any(String),
        created_at: expect.any(Date),
      });
    });

    it('should handle empty bot response gracefully', async () => {
      // Mock Ollama API response with empty content
      const mockOllamaResponse = {
        message: {
          content: '',
        },
        prompt_eval_count: 50,
      };

      // eslint-disable-next-line no-unused-vars
      fetch.mockImplementation((url, _options) => {
        if (url.includes('/api/embed')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                embeddings: [new Array(1024).fill(0.1)],
              }),
          });
        }

        if (url.includes('/api/chat')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOllamaResponse),
          });
        }

        return Promise.reject(new Error('Unexpected API call'));
      });

      const testMessage = {
        msg: 'Test message',
        userId: 'test_user_2',
      };

      const response = await request(app).post('/api/chat').send(testMessage);

      expect(response.status).toBe(200);
      expect(response.body.bot).toBe('');
      expect(response.body.prompt_eval_count).toBe(50);
    });

    it('should handle malformed Ollama response', async () => {
      // Mock Ollama API response with missing message
      const mockOllamaResponse = {
        prompt_eval_count: 0,
      };

      // eslint-disable-next-line no-unused-vars
      fetch.mockImplementation((url, _options) => {
        if (url.includes('/api/embed')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                embeddings: [new Array(1024).fill(0.1)],
              }),
          });
        }

        if (url.includes('/api/chat')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOllamaResponse),
          });
        }

        return Promise.reject(new Error('Unexpected API call'));
      });

      const testMessage = {
        msg: 'Test message',
        userId: 'test_user_3',
      };

      const response = await request(app).post('/api/chat').send(testMessage);

      expect(response.status).toBe(200);
      expect(response.body.bot).toBe('');
      expect(response.body.prompt_eval_count).toBe(0);
    });

    it('should calculate context percentage correctly with multiple messages', async () => {
      // Mock Ollama API response
      const mockOllamaResponse = {
        message: {
          content: 'This is a test response',
        },
        prompt_eval_count: 100,
      };

      // eslint-disable-next-line no-unused-vars
      fetch.mockImplementation((url, _options) => {
        if (url.includes('/api/embed')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                embeddings: [new Array(1024).fill(0.1)],
              }),
          });
        }

        if (url.includes('/api/chat')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOllamaResponse),
          });
        }

        return Promise.reject(new Error('Unexpected API call'));
      });

      const userId = 'test_user_context';

      // Send multiple messages to build up context
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/chat')
          .send({
            msg: `Test message ${i + 1}`,
            userId,
          });
      }

      const finalResponse = await request(app).post('/api/chat').send({
        msg: 'Final test message',
        userId,
      });

      expect(finalResponse.status).toBe(200);
      expect(parseFloat(finalResponse.body.context_percent)).toBeGreaterThan(0);

      // Verify we have accumulated messages
      const { rows } = await pool.query(
        'SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1',
        [userId],
      );
      expect(parseInt(rows[0].count)).toBe(8); // 4 user messages + 4 bot responses
    });

    it('should handle missing required fields', async () => {
      const response = await request(app).post('/api/chat').send({
        msg: 'Test message',
        // Missing userId
      });

      expect(response.status).toBe(500);
    });

    it('should handle Ollama API error', async () => {
      // Mock fetch to throw an error
      fetch.mockRejectedValueOnce(new Error('Ollama API connection failed'));

      const testMessage = {
        msg: 'Test message',
        userId: 'test_user_error',
      };

      const response = await request(app).post('/api/chat').send(testMessage);

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/chat/:userId', () => {
    it('should delete all messages for a user', async () => {
      const userId = 'test_user_delete';

      // First, add some messages
      await pool.query(
        'INSERT INTO chat_memory (user_id, role, content, embedding) VALUES ($1, $2, $3, $4)',
        [userId, 'user', 'Test message 1', `[${new Array(1024).fill(0.1).join(',')}]`],
      );
      await pool.query(
        'INSERT INTO chat_memory (user_id, role, content, embedding) VALUES ($1, $2, $3, $4)',
        [userId, 'bot', 'Test response 1', `[${new Array(1024).fill(0.1).join(',')}]`],
      );

      // Verify messages exist
      const { rows: beforeDelete } = await pool.query(
        'SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1',
        [userId],
      );
      expect(parseInt(beforeDelete[0].count)).toBe(2);

      // Delete messages
      const response = await request(app).delete(`/api/chat/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'All messages deleted successfully',
      });

      // Verify messages are deleted
      const { rows: afterDelete } = await pool.query(
        'SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1',
        [userId],
      );
      expect(parseInt(afterDelete[0].count)).toBe(0);
    });

    it('should handle deletion of non-existent user', async () => {
      const response = await request(app).delete('/api/chat/non_existent_user');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'All messages deleted successfully',
      });
    });

    it('should only delete messages for the specified user', async () => {
      const userId1 = 'test_user_keep';
      const userId2 = 'test_user_delete_specific';

      // Add messages for both users
      await pool.query(
        'INSERT INTO chat_memory (user_id, role, content, embedding) VALUES ($1, $2, $3, $4)',
        [userId1, 'user', 'Keep this message', `[${new Array(1024).fill(0.1).join(',')}]`],
      );
      await pool.query(
        'INSERT INTO chat_memory (user_id, role, content, embedding) VALUES ($1, $2, $3, $4)',
        [userId2, 'user', 'Delete this message', `[${new Array(1024).fill(0.1).join(',')}]`],
      );

      // Delete messages for userId2 only
      const response = await request(app).delete(`/api/chat/${userId2}`);

      expect(response.status).toBe(200);

      // Verify userId1 messages still exist
      const { rows: user1Messages } = await pool.query(
        'SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1',
        [userId1],
      );
      expect(parseInt(user1Messages[0].count)).toBe(1);

      // Verify userId2 messages are deleted
      const { rows: user2Messages } = await pool.query(
        'SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1',
        [userId2],
      );
      expect(parseInt(user2Messages[0].count)).toBe(0);
    });
  });
});
