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

  describe('POST /api/chatbot', () => {
    it('should send a message and receive a streaming response', async () => {
      const mockResponseContent =
        "Hello! I'm a senior software engineer. How can I help you with your React, Express, or Node.js questions?";

      // Mock streaming response
      const mockStreamData = [
        JSON.stringify({ message: { content: 'Hello! ' }, done: false }),
        JSON.stringify({ message: { content: "I'm a senior " }, done: false }),
        JSON.stringify({ message: { content: 'software engineer. ' }, done: false }),
        JSON.stringify({
          message: {
            content: 'How can I help you with your React, Express, or Node.js questions?',
          },
          done: false,
        }),
        JSON.stringify({ done: true }),
      ];

      // Override the default fetch mock for this test
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
          // Mock streaming response
          const mockStream = new ReadableStream({
            start(controller) {
              mockStreamData.forEach((data) => {
                controller.enqueue(new TextEncoder().encode(data + '\n'));
              });
              controller.close();
            },
          });

          return Promise.resolve({
            ok: true,
            body: mockStream,
          });
        }

        return Promise.reject(new Error('Unexpected API call'));
      });

      const testMessage = {
        msg: 'Hello, I need help with React hooks',
        userId: 'test_user_1',
        chatId: 'test_chat_1',
      };

      const response = await request(app).post('/api/chatbot').send(testMessage);

      // Should get immediate streaming confirmation response
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        streaming: true,
        message: 'Streaming response via WebSocket',
      });

      // Wait a bit for the streaming to complete and message to be stored
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the messages were stored in the database
      const { rows } = await pool.query(
        'SELECT * FROM chat_memory WHERE user_id = $1 AND chat_id = $2 ORDER BY created_at',
        ['test_user_1', 'test_chat_1'],
      );

      expect(rows).toHaveLength(2); // user message + bot response
      expect(rows[0]).toEqual({
        id: expect.any(Number),
        chat_id: 'test_chat_1',
        user_id: 'test_user_1',
        role: 'user',
        content: 'Hello, I need help with React hooks',
        embedding: expect.any(String),
        created_at: expect.any(Date),
      });
      expect(rows[1]).toEqual({
        id: expect.any(Number),
        chat_id: 'test_chat_1',
        user_id: 'test_user_1',
        role: 'bot',
        content: mockResponseContent,
        embedding: expect.any(String),
        created_at: expect.any(Date),
      });
    });

    it('should handle empty bot response gracefully', async () => {
      // Mock streaming response with empty content
      const mockStreamData = [
        JSON.stringify({ done: true }), // No content, just done
      ];

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
          // Mock streaming response with no content
          const mockStream = new ReadableStream({
            start(controller) {
              mockStreamData.forEach((data) => {
                controller.enqueue(new TextEncoder().encode(data + '\n'));
              });
              controller.close();
            },
          });

          return Promise.resolve({
            ok: true,
            body: mockStream,
          });
        }

        return Promise.reject(new Error('Unexpected API call'));
      });

      const testMessage = {
        msg: 'Test message',
        userId: 'test_user_2',
        chatId: 'test_chat_2',
      };

      const response = await request(app).post('/api/chatbot').send(testMessage);

      // Should get immediate streaming confirmation response
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        streaming: true,
        message: 'Streaming response via WebSocket',
      });

      // Wait for streaming to complete and message to be stored
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the bot response was stored as empty string
      const { rows } = await pool.query(
        'SELECT * FROM chat_memory WHERE user_id = $1 AND chat_id = $2 AND role = $3 ORDER BY created_at',
        ['test_user_2', 'test_chat_2', 'bot'],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].content).toBe('');
    });

    it('should handle malformed Ollama response', async () => {
      // Mock streaming response with malformed data
      const mockStreamData = [
        'invalid json', // This should be ignored
        JSON.stringify({ invalid: 'structure' }), // This should be ignored
        JSON.stringify({ done: true }), // This should complete the stream
      ];

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
          // Mock streaming response with malformed data
          const mockStream = new ReadableStream({
            start(controller) {
              mockStreamData.forEach((data) => {
                controller.enqueue(new TextEncoder().encode(data + '\n'));
              });
              controller.close();
            },
          });

          return Promise.resolve({
            ok: true,
            body: mockStream,
          });
        }

        return Promise.reject(new Error('Unexpected API call'));
      });

      const testMessage = {
        msg: 'Test message',
        userId: 'test_user_3',
        chatId: 'test_chat_3',
      };

      const response = await request(app).post('/api/chatbot').send(testMessage);

      // Should get immediate streaming confirmation response
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        streaming: true,
        message: 'Streaming response via WebSocket',
      });

      // Wait for streaming to complete and message to be stored
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the bot response was stored as empty string (no valid content received)
      const { rows } = await pool.query(
        'SELECT * FROM chat_memory WHERE user_id = $1 AND chat_id = $2 AND role = $3 ORDER BY created_at',
        ['test_user_3', 'test_chat_3', 'bot'],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].content).toBe('');
    });

    it('should calculate context percentage correctly with multiple messages', async () => {
      const mockResponseContent = 'This is a test response';

      // Mock streaming response
      const mockStreamData = [
        JSON.stringify({ message: { content: mockResponseContent }, done: false }),
        JSON.stringify({ done: true }),
      ];

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
          // Mock streaming response
          const mockStream = new ReadableStream({
            start(controller) {
              mockStreamData.forEach((data) => {
                controller.enqueue(new TextEncoder().encode(data + '\n'));
              });
              controller.close();
            },
          });

          return Promise.resolve({
            ok: true,
            body: mockStream,
          });
        }

        return Promise.reject(new Error('Unexpected API call'));
      });

      const userId = 'test_user_context';
      const chatId = 'test_chat_context';

      // Send multiple messages to build up context
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/chatbot')
          .send({
            msg: `Test message ${i + 1}`,
            userId,
            chatId,
          });

        // Should get streaming confirmation
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          streaming: true,
          message: 'Streaming response via WebSocket',
        });

        // Wait for processing to complete
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const finalResponse = await request(app).post('/api/chatbot').send({
        msg: 'Final test message',
        userId,
        chatId,
      });

      expect(finalResponse.status).toBe(200);
      expect(finalResponse.body).toEqual({
        streaming: true,
        message: 'Streaming response via WebSocket',
      });

      // Wait for final processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify we have accumulated messages
      const { rows } = await pool.query(
        'SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1 AND chat_id = $2',
        [userId, chatId],
      );
      expect(parseInt(rows[0].count)).toBe(8); // 4 user messages + 4 bot responses
    });

    it('should handle missing required fields', async () => {
      const response = await request(app).post('/api/chatbot').send({
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
        chatId: 'test_chat_error',
      };

      const response = await request(app).post('/api/chatbot').send(testMessage);

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/chatbot/:userId', () => {
    it('should delete all messages for a user', async () => {
      const userId = 'test_user_delete';

      // First, add some messages
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5)',
        [
          'test_chat_delete',
          userId,
          'user',
          'Test message 1',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5)',
        [
          'test_chat_delete',
          userId,
          'bot',
          'Test response 1',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );

      // Verify messages exist
      const { rows: beforeDelete } = await pool.query(
        'SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1',
        [userId],
      );
      expect(parseInt(beforeDelete[0].count)).toBe(2);

      // Delete messages
      const response = await request(app).delete(`/api/chatbot/${userId}`);

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
      const response = await request(app).delete('/api/chatbot/non_existent_user');

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
        'INSERT INTO chat_memory (chat_id, user_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5)',
        [
          'test_chat_keep',
          userId1,
          'user',
          'Keep this message',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5)',
        [
          'test_chat_delete_specific',
          userId2,
          'user',
          'Delete this message',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );

      // Delete messages for userId2 only
      const response = await request(app).delete(`/api/chatbot/${userId2}`);

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
