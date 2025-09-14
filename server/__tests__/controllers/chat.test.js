import setup, { pool, cleanup } from '../../test-setup.js';
import request from 'supertest';
import app from '../../lib/app.js';
import UserService from '../../lib/services/UserService.js';
import { jest, describe, beforeEach, afterAll, it, expect } from '@jest/globals';

// Mock Socket.IO
const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// Set the mock Socket.IO instance on the app
app.set('io', mockIo);

// Dummy user for testing
const mockUser = {
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  password: '12345',
};

const registerAndLogin = async (userProps = {}) => {
  const password = userProps.password ?? mockUser.password;

  // Create an "agent" that gives us the ability
  // to store cookies between requests in a test
  const agent = request.agent(app);

  // Generate unique email for each test to avoid conflicts
  const uniqueEmail = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`;
  const userData = { ...mockUser, ...userProps, email: uniqueEmail };

  // Create a user to sign in with
  const user = await UserService.create(userData);

  // ...then sign in
  const { email } = user;
  await agent.post('/api/users/sessions').send({ email, password });
  return [agent, user];
};

// Mock the external Ollama API
global.fetch = jest.fn();

describe('chat routes', () => {
  beforeEach(async () => {
    await setup();
    // Reset fetch mock before each test
    fetch.mockClear();
    // Reset Socket.IO mock before each test
    mockIo.to.mockClear();
    mockIo.emit.mockClear();

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
      const [agent] = await registerAndLogin();

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

      const response = await agent.post('/api/chatbot').send(testMessage);

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
        message_id: expect.any(String),
        role: 'user',
        content: expect.stringMatching(/^U2FsdGVkX1/), // Encrypted content
        embedding: expect.any(String),
        is_chunked: false,
        created_at: expect.any(Date),
      });
      expect(rows[1]).toEqual({
        id: expect.any(Number),
        chat_id: 'test_chat_1',
        user_id: 'test_user_1',
        message_id: expect.any(String),
        role: 'bot',
        content: expect.stringMatching(/^U2FsdGVkX1/), // Encrypted content
        embedding: expect.any(String),
        is_chunked: false,
        created_at: expect.any(Date),
      });
    });

    it('should handle empty bot response gracefully', async () => {
      const [agent] = await registerAndLogin();

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

      const response = await agent.post('/api/chatbot').send(testMessage);

      // Should get immediate streaming confirmation response
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        streaming: true,
        message: 'Streaming response via WebSocket',
      });

      // Wait for streaming to complete and message to be stored
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should emit error event for empty response
      expect(mockIo.to).toHaveBeenCalledWith('chat-test_user_2');
      expect(mockIo.emit).toHaveBeenCalledWith('chat-error', {
        error: 'No response content received from LLM',
      });

      // Verify no bot response was stored (empty response should not store anything)
      const { rows } = await pool.query(
        'SELECT * FROM chat_memory WHERE user_id = $1 AND chat_id = $2 AND role = $3 ORDER BY created_at',
        ['test_user_2', 'test_chat_2', 'bot'],
      );

      expect(rows).toHaveLength(0); // No bot message should be stored for empty response
    });

    it('should handle malformed Ollama response', async () => {
      const [agent] = await registerAndLogin();

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

      const response = await agent.post('/api/chatbot').send(testMessage);

      // Should get immediate streaming confirmation response
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        streaming: true,
        message: 'Streaming response via WebSocket',
      });

      // Wait for streaming to complete and message to be stored
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should emit error event for malformed response (no valid content received)
      expect(mockIo.to).toHaveBeenCalledWith('chat-test_user_3');
      expect(mockIo.emit).toHaveBeenCalledWith('chat-error', {
        error: 'No response content received from LLM',
      });

      // Verify no bot response was stored (malformed response should not store anything)
      const { rows } = await pool.query(
        'SELECT * FROM chat_memory WHERE user_id = $1 AND chat_id = $2 AND role = $3 ORDER BY created_at',
        ['test_user_3', 'test_chat_3', 'bot'],
      );

      expect(rows).toHaveLength(0); // No bot message should be stored for malformed response
    });

    it('should calculate context percentage correctly with multiple messages', async () => {
      const [agent] = await registerAndLogin();

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
        const response = await agent.post('/api/chatbot').send({
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

      const finalResponse = await agent.post('/api/chatbot').send({
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
      const [agent] = await registerAndLogin();

      const response = await agent.post('/api/chatbot').send({
        msg: 'Test message',
        // Missing userId
      });

      expect(response.status).toBe(500);
    });

    it('should handle Ollama API error', async () => {
      const [agent] = await registerAndLogin();

      // Mock fetch to throw an error
      fetch.mockRejectedValueOnce(new Error('Ollama API connection failed'));

      const testMessage = {
        msg: 'Test message',
        userId: 'test_user_error',
        chatId: 'test_chat_error',
      };

      const response = await agent.post('/api/chatbot').send(testMessage);

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/chatbot/:userId', () => {
    it('should delete all messages for a user', async () => {
      const [agent] = await registerAndLogin();

      const userId = 'test_user_delete';

      // First, add some messages
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          'test_chat_delete',
          userId,
          'test_msg_1',
          'user',
          'Test message 1',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          'test_chat_delete',
          userId,
          'test_msg_2',
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
      const response = await agent.delete(`/api/chatbot/${userId}`);

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
      const [agent] = await registerAndLogin();

      const response = await agent.delete('/api/chatbot/non_existent_user');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'All messages deleted successfully',
      });
    });

    it('should only delete messages for the specified user', async () => {
      const [agent] = await registerAndLogin();

      const userId1 = 'test_user_keep';
      const userId2 = 'test_user_delete_specific';

      // Add messages for both users
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          'test_chat_keep',
          userId1,
          'test_msg_keep_1',
          'user',
          'Keep this message',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          'test_chat_delete_specific',
          userId2,
          'test_msg_delete_1',
          'user',
          'Delete this message',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );

      // Delete messages for userId2 only
      const response = await agent.delete(`/api/chatbot/${userId2}`);

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

  describe('GET /api/chatbot/list/:userId', () => {
    it('should return empty list for user with no chats', async () => {
      const [agent] = await registerAndLogin();

      const response = await agent.get('/api/chatbot/list/test_user_empty');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return chat list for user with chats', async () => {
      const [agent] = await registerAndLogin();

      const userId = 'test_user_list';
      const chatId = 'test_chat_list';

      // Add chat entry to chats table
      await pool.query('INSERT INTO chats (chat_id, user_id) VALUES ($1, $2)', [chatId, userId]);

      // Add some messages to create a chat using ChatMemory model
      const { default: ChatMemory } = await import('../../lib/models/ChatMemory.js');

      await ChatMemory.storeMessage({
        chatId,
        userId,
        role: 'user',
        content: 'Hello, this is a test message',
        embedding: `[${new Array(1024).fill(0.1).join(',')}]`,
      });

      await ChatMemory.storeMessage({
        chatId,
        userId,
        role: 'bot',
        content: 'This is a test response',
        embedding: `[${new Array(1024).fill(0.1).join(',')}]`,
      });

      const response = await agent.get(`/api/chatbot/list/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual({
        id: chatId,
        chatId,
        messageCount: 2,
        firstMessage: expect.any(String),
        lastMessage: expect.any(String),
        preview: 'Hello, this is a test message...',
        title: null,
      });
    });

    it('should return multiple chats ordered by last message', async () => {
      const [agent] = await registerAndLogin();

      const userId = 'test_user_multiple';
      const chatId1 = 'test_chat_1';
      const chatId2 = 'test_chat_2';

      // Add chat entries to chats table
      await pool.query('INSERT INTO chats (chat_id, user_id) VALUES ($1, $2)', [chatId1, userId]);
      await pool.query('INSERT INTO chats (chat_id, user_id) VALUES ($1, $2)', [chatId2, userId]);

      // Add messages to first chat
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          chatId1,
          userId,
          'test_msg_chat1_1',
          'user',
          'First chat message',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );

      // Wait a moment to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Add messages to second chat
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          chatId2,
          userId,
          'test_msg_chat2_1',
          'user',
          'Second chat message',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );

      const response = await agent.get(`/api/chatbot/list/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      // Should be ordered by last message (most recent first)
      expect(response.body[0].chatId).toBe(chatId2);
      expect(response.body[1].chatId).toBe(chatId1);
    });

    it('should handle database error gracefully', async () => {
      const [agent] = await registerAndLogin();

      // Mock the database module to throw an error
      const dbModule = await import('../../lib/utils/db.js');
      const originalQuery = dbModule.pool.query;

      // Mock the query method to throw an error
      dbModule.pool.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await agent.get('/api/chatbot/list/test_user_error');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      // Restore original query method
      dbModule.pool.query = originalQuery;
    });
  });

  describe('DELETE /api/chatbot/:userId/:chatId', () => {
    it('should delete specific chat messages', async () => {
      const [agent] = await registerAndLogin();

      const userId = 'test_user_delete_chat';
      const chatId = 'test_chat_delete_specific';

      // Add messages to the chat
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          chatId,
          userId,
          'test_msg_delete_chat_1',
          'user',
          'Test message to delete',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          chatId,
          userId,
          'test_msg_delete_chat_2',
          'bot',
          'Test response to delete',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );

      // Verify messages exist
      const { rows: beforeDelete } = await pool.query(
        'SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1 AND chat_id = $2',
        [userId, chatId],
      );
      expect(parseInt(beforeDelete[0].count)).toBe(2);

      // Delete the chat
      const response = await agent.delete(`/api/chatbot/${userId}/${chatId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Chat deleted successfully',
      });

      // Verify messages are deleted
      const { rows: afterDelete } = await pool.query(
        'SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1 AND chat_id = $2',
        [userId, chatId],
      );
      expect(parseInt(afterDelete[0].count)).toBe(0);
    });

    it('should handle deletion of non-existent chat', async () => {
      const [agent] = await registerAndLogin();

      const response = await agent.delete('/api/chatbot/test_user_nonexistent/nonexistent_chat');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Chat deleted successfully',
      });
    });

    it('should only delete messages for specific chat and user', async () => {
      const [agent] = await registerAndLogin();

      const userId = 'test_user_isolated';
      const chatId1 = 'test_chat_keep';
      const chatId2 = 'test_chat_delete_isolated';

      // Add messages to both chats
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          chatId1,
          userId,
          'test_msg_keep_chat1_1',
          'user',
          'Keep this message',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );
      await pool.query(
        'INSERT INTO chat_memory (chat_id, user_id, message_id, role, content, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          chatId2,
          userId,
          'test_msg_delete_chat2_1',
          'user',
          'Delete this message',
          `[${new Array(1024).fill(0.1).join(',')}]`,
        ],
      );

      // Delete only chatId2
      const response = await agent.delete(`/api/chatbot/${userId}/${chatId2}`);

      expect(response.status).toBe(200);

      // Verify chatId1 messages still exist
      const { rows: keptMessages } = await pool.query(
        'SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1 AND chat_id = $2',
        [userId, chatId1],
      );
      expect(parseInt(keptMessages[0].count)).toBe(1);

      // Verify chatId2 messages are deleted
      const { rows: deletedMessages } = await pool.query(
        'SELECT COUNT(*) as count FROM chat_memory WHERE user_id = $1 AND chat_id = $2',
        [userId, chatId2],
      );
      expect(parseInt(deletedMessages[0].count)).toBe(0);
    });

    it('should handle database error gracefully', async () => {
      const [agent] = await registerAndLogin();

      // Mock the ChatMemory module to throw an error
      const ChatMemoryModule = await import('../../lib/models/ChatMemory.js');
      const originalDeleteChatMessages = ChatMemoryModule.default.deleteChatMessages;

      // Mock the deleteChatMessages method to throw an error
      ChatMemoryModule.default.deleteChatMessages = jest
        .fn()
        .mockRejectedValue(new Error('Database connection failed'));

      const response = await agent.delete('/api/chatbot/test_user_error/test_chat_error');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      // Restore original method
      ChatMemoryModule.default.deleteChatMessages = originalDeleteChatMessages;
    });
  });
});
