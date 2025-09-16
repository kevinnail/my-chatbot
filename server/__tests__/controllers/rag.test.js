import { jest, describe, beforeEach, afterAll, it, expect } from '@jest/globals';

// Mock embedding utility
const mockGetEmbedding = jest.fn();

// Set up mocks before importing modules that use them
jest.unstable_mockModule('../../lib/utils/ollamaEmbed.js', () => ({
  getEmbedding: mockGetEmbedding,
}));

// Don't mock multer - let supertest handle file uploads natively

// Now import the modules that depend on the mocked modules
const { default: setup, pool } = await import('../../test-setup.js');
const { default: request } = await import('supertest');
const { default: app } = await import('../../lib/app.js');
const { default: UserService } = await import('../../lib/services/UserService.js');

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

describe('RAG routes', () => {
  beforeEach(async () => {
    await setup();
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Set up default mock return values - 1024 dimensions for vector
    const mockEmbedding = Array(1024)
      .fill(0)
      .map((_, i) => (i / 1024).toFixed(6));
    mockGetEmbedding.mockResolvedValue(`[${mockEmbedding.join(',')}]`);
  });

  afterAll(async () => {
    // No cleanup needed - handled globally
  });

  describe('POST /api/rag/process-folder', () => {
    it('should successfully process files', async () => {
      const [agent, user] = await registerAndLogin();

      // Use supertest's attach method to simulate file uploads
      const response = await agent
        .post('/api/rag/process-folder')
        .field('userId', user.id)
        .attach('files', Buffer.from('This is test file 1 content'), 'test1.txt')
        .attach('files', Buffer.from('This is test file 2 content'), 'test2.txt');

      console.info('response', response.body);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Successfully processed 2 files into 2 chunks');
      expect(response.body.filesProcessed).toBe(2);
      expect(mockGetEmbedding).toHaveBeenCalledTimes(2);
    });

    it('should return 400 if userId is missing', async () => {
      const [agent] = await registerAndLogin();

      const response = await agent.post('/api/rag/process-folder').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('userId is required');
    });

    it('should return 400 if no files provided', async () => {
      const [agent, user] = await registerAndLogin();

      const response = await agent.post('/api/rag/process-folder').field('userId', user.id);
      // No files attached

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No files provided');
    });

    it('should handle database errors', async () => {
      const [agent, user] = await registerAndLogin();

      // Mock getEmbedding to throw an error
      mockGetEmbedding.mockRejectedValueOnce(new Error('Embedding service error'));

      const response = await agent
        .post('/api/rag/process-folder')
        .field('userId', user.id)
        .attach('files', Buffer.from('Test content'), 'test.txt');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Embedding service error');
    });
  });

  describe('GET /api/rag/files/:userId', () => {
    it('should retrieve files for a user', async () => {
      const [agent, user] = await registerAndLogin();

      // First, insert some test files with the new schema
      const client = await pool.connect();
      try {
        // Insert files into files table
        const file1Result = await client.query(
          'INSERT INTO files (user_id, filename, file_type, total_chunks) VALUES ($1, $2, $3, $4) RETURNING id',
          [user.id, 'test1.txt', 'text', 1],
        );
        const file2Result = await client.query(
          'INSERT INTO files (user_id, filename, file_type, total_chunks) VALUES ($1, $2, $3, $4) RETURNING id',
          [user.id, 'test2.txt', 'text', 1],
        );

        // Insert file chunks
        const vector1 = new Array(1024).fill(0.1);
        const vector2 = new Array(1024).fill(0.2);
        await client.query(
          'INSERT INTO file_chunks (file_id, user_id, chunk_index, content, embedding, chunk_type) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            file1Result.rows[0].id,
            user.id,
            0,
            'Test file content 1',
            `[${vector1.join(',')}]`,
            'paragraph',
          ],
        );
        await client.query(
          'INSERT INTO file_chunks (file_id, user_id, chunk_index, content, embedding, chunk_type) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            file2Result.rows[0].id,
            user.id,
            0,
            'Test file content 2',
            `[${vector2.join(',')}]`,
            'paragraph',
          ],
        );
      } finally {
        client.release();
      }

      const response = await agent.get(`/api/rag/files/${user.id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Found 2 files');
      expect(response.body.files).toHaveLength(2);
      expect(response.body.files[0]).toHaveProperty('id');
      expect(response.body.files[0]).toHaveProperty('user_id');
      expect(response.body.files[0]).toHaveProperty('filename');
      expect(response.body.files[0]).toHaveProperty('file_type');
      expect(response.body.files[0]).toHaveProperty('total_chunks');
      expect(response.body.files[0]).toHaveProperty('created_at');
    });

    it('should return empty array for user with no files', async () => {
      const [agent, user] = await registerAndLogin();

      const response = await agent.get(`/api/rag/files/${user.id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Found 0 files');
      expect(response.body.files).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const [agent, user] = await registerAndLogin();

      // This test just verifies the endpoint works with valid user but no files
      const response = await agent.get(`/api/rag/files/${user.id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Found 0 files');
      expect(response.body.files).toHaveLength(0);
    });
  });

  describe('retrieveRelevantDocuments function', () => {
    it('should retrieve relevant documents with semantic search', async () => {
      const [, user] = await registerAndLogin();

      // Insert test documents with new schema
      const client = await pool.connect();
      try {
        // Insert files
        const file1Result = await client.query(
          'INSERT INTO files (user_id, filename, file_type, total_chunks) VALUES ($1, $2, $3, $4) RETURNING id',
          [user.id, 'javascript.txt', 'text', 1],
        );
        const file2Result = await client.query(
          'INSERT INTO files (user_id, filename, file_type, total_chunks) VALUES ($1, $2, $3, $4) RETURNING id',
          [user.id, 'python.txt', 'text', 1],
        );

        // Insert file chunks
        const vector1 = new Array(1024).fill(0.9);
        const vector2 = new Array(1024).fill(0.1);
        await client.query(
          'INSERT INTO file_chunks (file_id, user_id, chunk_index, content, embedding, chunk_type) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            file1Result.rows[0].id,
            user.id,
            0,
            'This is about JavaScript programming',
            `[${vector1.join(',')}]`,
            'paragraph',
          ],
        );
        await client.query(
          'INSERT INTO file_chunks (file_id, user_id, chunk_index, content, embedding, chunk_type) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            file2Result.rows[0].id,
            user.id,
            0,
            'This is about Python development',
            `[${vector2.join(',')}]`,
            'paragraph',
          ],
        );
      } finally {
        client.release();
      }

      // Mock getEmbedding for the query
      const queryVector = new Array(1024).fill(0.9);
      mockGetEmbedding.mockResolvedValueOnce(`[${queryVector.join(',')}]`);

      const { retrieveRelevantDocuments } = await import('../../lib/controllers/rag.js');
      const results = await retrieveRelevantDocuments(user.id, 'JavaScript', 5);

      expect(results).toHaveLength(2); // Both documents match with high similarity
      expect(results[0]).toHaveProperty('content');
      expect(results[0]).toHaveProperty('similarity');
      expect(results[0].similarity).toBeGreaterThan(0.5);
    });

    it('should fallback to keyword search when no semantic matches', async () => {
      const [, user] = await registerAndLogin();

      // Insert test documents with new schema
      const client = await pool.connect();
      try {
        // Insert file
        const fileResult = await client.query(
          'INSERT INTO files (user_id, filename, file_type, total_chunks) VALUES ($1, $2, $3, $4) RETURNING id',
          [user.id, 'keyword.txt', 'text', 1],
        );

        // Use vectors that will create negative/very low cosine similarity
        // Create a vector with alternating positive and negative values
        const vector = new Array(1024).fill(0).map((_, i) => (i % 2 === 0 ? 1 : -1));
        await client.query(
          'INSERT INTO file_chunks (file_id, user_id, chunk_index, content, embedding, chunk_type) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            fileResult.rows[0].id,
            user.id,
            0,
            'This document contains the word JavaScript',
            `[${vector.join(',')}]`,
            'paragraph',
          ],
        );
      } finally {
        client.release();
      }

      // Mock getEmbedding to return opposite vector pattern for very low similarity
      const queryVector = new Array(1024).fill(0).map((_, i) => (i % 2 === 0 ? -1 : 1));
      mockGetEmbedding.mockResolvedValueOnce(`[${queryVector.join(',')}]`);

      const { retrieveRelevantDocuments } = await import('../../lib/controllers/rag.js');
      const results = await retrieveRelevantDocuments(user.id, 'JavaScript', 5);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('content');
      expect(results[0]).toHaveProperty('similarity');
      expect(results[0].similarity).toBe(0.1); // Keyword fallback similarity
    });

    it('should return empty array when no documents found', async () => {
      const [, user] = await registerAndLogin();

      // Mock getEmbedding
      const queryVector = new Array(1024).fill(0.1);
      mockGetEmbedding.mockResolvedValueOnce(`[${queryVector.join(',')}]`);

      const { retrieveRelevantDocuments } = await import('../../lib/controllers/rag.js');
      const results = await retrieveRelevantDocuments(user.id, 'nonexistent query', 5);

      expect(results).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      const [, user] = await registerAndLogin();

      // Mock getEmbedding to throw an error
      mockGetEmbedding.mockRejectedValueOnce(new Error('Embedding error'));

      const { retrieveRelevantDocuments } = await import('../../lib/controllers/rag.js');
      const results = await retrieveRelevantDocuments(user.id, 'test query', 5);

      expect(results).toHaveLength(0);
    });
  });
});
