import { jest, describe, beforeEach, afterAll, it, expect } from '@jest/globals';

// Mock the external APIs and utilities
global.fetch = jest.fn();

// Mock the IMAP utilities - need to mock before importing
const mockTestImapConnection = jest.fn();
const mockGetEmailsViaImap = jest.fn();

// Mock email analysis utility
const mockAnalyzeEmailWithLLM = jest.fn();

// Mock vector similarity utility
const mockPreFilterWebDevEmails = jest.fn();

// Mock embedding utility
const mockGetEmbedding = jest.fn();

// Set up mocks before importing modules that use them
jest.unstable_mockModule('../../lib/utils/gmailImap.js', () => ({
  testImapConnection: mockTestImapConnection,
  getEmailsViaImap: mockGetEmailsViaImap,
}));

jest.unstable_mockModule('../../lib/utils/emailAnalysis.js', () => ({
  analyzeEmailWithLLM: mockAnalyzeEmailWithLLM,
}));

jest.unstable_mockModule('../../lib/utils/vectorSimilarity.js', () => ({
  preFilterWebDevEmails: mockPreFilterWebDevEmails,
}));

jest.unstable_mockModule('../../lib/utils/ollamaEmbed.js', () => ({
  getEmbedding: mockGetEmbedding,
}));

// Now import the modules that depend on the mocked modules
const { default: setup, pool, cleanup } = await import('../../test-setup.js');
const { default: request } = await import('supertest');
const { default: app } = await import('../../lib/app.js');

describe('gmail routes', () => {
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
    jest.clearAllMocks();
    await cleanup();
  });

  describe('GET /api/gmail/status/:userId', () => {
    it('should return not connected when IMAP credentials are missing', async () => {
      // Temporarily remove env vars
      const originalUser = process.env.GMAIL_USER;
      const originalPassword = process.env.GMAIL_APP_PASSWORD;
      delete process.env.GMAIL_USER;
      delete process.env.GMAIL_APP_PASSWORD;

      const response = await request(app).get('/api/gmail/status/test_user');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        connected: false,
        error: 'IMAP credentials not configured',
      });

      // Restore env vars
      if (originalUser) process.env.GMAIL_USER = originalUser;
      if (originalPassword) process.env.GMAIL_APP_PASSWORD = originalPassword;
    });

    it('should return not connected when IMAP connection fails', async () => {
      // Set up env vars
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = 'test_password';

      mockTestImapConnection.mockRejectedValueOnce(new Error('Connection failed'));

      const response = await request(app).get('/api/gmail/status/test_user');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        connected: false,
        error: 'IMAP connection failed',
      });
    });

    it('should return connected status with last sync time', async () => {
      // Set up env vars
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = 'test_password';

      // Clear and set up the mock
      mockTestImapConnection.mockClear();
      mockTestImapConnection.mockResolvedValueOnce(true);

      // Add a sync status record
      const userId = 'test_user_status';
      await pool.query('INSERT INTO gmail_sync_status (user_id, last_sync) VALUES ($1, $2)', [
        userId,
        new Date(),
      ]);

      const response = await request(app).get(`/api/gmail/status/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        connected: true,
        lastSync: expect.any(String),
      });

      // Verify the mock was called
      expect(mockTestImapConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/gmail/connect', () => {
    it('should successfully connect to Gmail IMAP', async () => {
      mockTestImapConnection.mockResolvedValueOnce();

      const response = await request(app)
        .post('/api/gmail/connect')
        .send({ userId: 'test_user_connect' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Gmail IMAP connection successful',
      });

      // Verify sync status was initialized
      const { rows } = await pool.query('SELECT * FROM gmail_sync_status WHERE user_id = $1', [
        'test_user_connect',
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBe('test_user_connect');
    });

    it('should handle IMAP connection failure', async () => {
      mockTestImapConnection.mockRejectedValueOnce(new Error('Connection failed'));

      const response = await request(app)
        .post('/api/gmail/connect')
        .send({ userId: 'test_user_fail' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to connect to Gmail via IMAP',
      });
    });
  });

  describe('GET /api/gmail/callback', () => {
    it('should redirect to client URL', async () => {
      process.env.CLIENT_URL = 'http://localhost:3000';

      const response = await request(app).get('/api/gmail/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('http://localhost:3000/gmail-mcp?connected=true');
    });
  });

  describe('POST /api/gmail/sync', () => {
    it('should sync emails and return preliminary results', async () => {
      const userId = 'test_user_sync';

      const mockEmails = [
        {
          id: 'email1',
          subject: 'React Development Question',
          from: 'developer@example.com',
          body: 'I need help with React hooks',
          date: new Date(),
        },
      ];

      const mockFilterResults = {
        likelyWebDevEmails: [
          {
            ...mockEmails[0],
            similarity: 0.85,
          },
        ],
        unlikelyEmails: [],
        reductionPercentage: 0,
      };
      console.log('mockFilterResults', mockFilterResults);

      mockGetEmailsViaImap.mockResolvedValueOnce(mockEmails);
      console.log('made it past mockGetEmailsVialmap--------------------');
      mockPreFilterWebDevEmails.mockResolvedValueOnce(mockFilterResults);
      console.log('made it past mockPreFilterWebDevEmails-------------------------');

      // Mock the embedding function to return a valid 1024-dimensional embedding
      const mockEmbedding = Array(1024)
        .fill(0)
        .map((_, i) => (i / 1024).toFixed(6));
      mockGetEmbedding.mockResolvedValue(`[${mockEmbedding.join(',')}]`);

      const response = await request(app).post('/api/gmail/sync').send({ userId });
      console.log('response.body=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=', response.body);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('emails');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('status', 'preliminary');
      expect(response.body).toHaveProperty('analysisInProgress', true);
      expect(response.body.emails).toHaveLength(1);
      expect(response.body.emails[0]).toEqual({
        id: 'email1',
        subject: 'React Development Question',
        from: 'developer@example.com',
        date: expect.any(String),
        analysis: null,
        webLink: 'https://mail.google.com/mail/u/0/#inbox',
        isNewSinceLastSync: true,
        summary: 'Analysis pending...',
        vectorSimilarity: '0.850',
        analyzed: false,
        category: null,
        priority: null,
        status: 'pending',
      });

      // Verify email was stored in database
      const { rows } = await pool.query('SELECT * FROM email_memory WHERE user_id = $1', [userId]);
      expect(rows).toHaveLength(1);
      expect(rows[0].email_id).toBe('email1');
      expect(rows[0].subject).toBe('React Development Question');
    });

    it('should handle sync errors gracefully', async () => {
      mockGetEmailsViaImap.mockRejectedValueOnce(new Error('IMAP error'));

      const response = await request(app)
        .post('/api/gmail/sync')
        .send({ userId: 'test_user_error' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to sync emails via IMAP',
      });
    });

    it('should skip emails that already exist in database', async () => {
      const userId = 'test_user_existing';

      // First, add an email to the database
      await pool.query(
        'INSERT INTO email_memory (user_id, email_id, subject, sender, body, email_date, similarity_score) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [userId, 'existing_email', 'Existing Email', 'sender@example.com', 'body', new Date(), 0.8],
      );

      const mockEmails = [
        {
          id: 'existing_email',
          subject: 'Existing Email',
          from: 'sender@example.com',
          body: 'body',
          date: new Date(),
        },
        {
          id: 'new_email',
          subject: 'New Email',
          from: 'new@example.com',
          body: 'new body',
          date: new Date(),
        },
      ];

      mockGetEmailsViaImap.mockResolvedValueOnce(mockEmails);
      mockPreFilterWebDevEmails.mockResolvedValueOnce({
        likelyWebDevEmails: [
          {
            id: 'new_email',
            subject: 'New Email',
            from: 'new@example.com',
            body: 'new body',
            date: mockEmails[1].date,
            similarity: 0.75,
          },
        ],
        unlikelyEmails: [],
        reductionPercentage: 50,
      });

      const response = await request(app).post('/api/gmail/sync').send({ userId });

      expect(response.status).toBe(200);
      expect(response.body.performance.totalFetched).toBe(2);
      expect(response.body.performance.newStored).toBe(1);

      // Verify only the new email was stored
      const { rows } = await pool.query(
        'SELECT COUNT(*) as count FROM email_memory WHERE user_id = $1',
        [userId],
      );
      expect(parseInt(rows[0].count)).toBe(2); // Original + new one
    });
  });

  describe('GET /api/gmail/emails/:userId', () => {
    it('should return stored web-dev emails', async () => {
      const userId = 'test_user_emails';

      // Add some test emails to the database
      await pool.query(
        'INSERT INTO email_memory (user_id, email_id, subject, sender, body, email_date, similarity_score, is_web_dev_related, llm_analyzed, llm_analysis) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [
          userId,
          'test_email_1',
          'React Question',
          'dev@example.com',
          'React body',
          new Date(),
          0.85,
          true,
          true,
          JSON.stringify({
            summary: 'React help needed',
            category: 'technical',
            priority: 'medium',
          }),
        ],
      );

      await pool.query(
        'INSERT INTO email_memory (user_id, email_id, subject, sender, body, email_date, similarity_score, is_web_dev_related, llm_analyzed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          userId,
          'test_email_2',
          'Vue Question',
          'vue@example.com',
          'Vue body',
          new Date(),
          0.75,
          true,
          false,
        ],
      );

      const response = await request(app).get(`/api/gmail/emails/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('emails');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('source', 'database');
      expect(response.body.emails).toHaveLength(2);
      console.log('response.body.emails', response.body.emails);
      expect(response.body.emails[0]).toEqual({
        id: 'test_email_2',
        subject: 'Vue Question',
        from: 'vue@example.com',
        date: expect.any(String),
        analysis: null,
        webLink: 'https://mail.google.com/mail/u/0/#inbox',
        summary: 'Analysis pending...',
        vectorSimilarity: '0.750',
        analyzed: false,
        category: null,
        priority: null,
      });
      expect(response.body.emails[1]).toEqual({
        id: 'test_email_1',
        subject: 'React Question',
        from: 'dev@example.com',
        date: expect.any(String),
        analysis: { summary: 'React help needed', category: 'technical', priority: 'medium' },
        webLink: 'https://mail.google.com/mail/u/0/#inbox',
        summary: 'React help needed',
        vectorSimilarity: '0.850',
        analyzed: true,
        category: 'technical',
        priority: 'medium',
      });
    });

    it('should return empty array for user with no emails', async () => {
      const response = await request(app).get('/api/gmail/emails/nonexistent_user');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        emails: [],
        total: 0,
        source: 'database',
      });
    });

    it('should respect limit parameter', async () => {
      const userId = 'test_user_limit';

      // Add multiple emails
      for (let i = 0; i < 5; i++) {
        await pool.query(
          'INSERT INTO email_memory (user_id, email_id, subject, sender, body, email_date, similarity_score, is_web_dev_related) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [
            userId,
            `email_${i}`,
            `Subject ${i}`,
            'sender@example.com',
            'body',
            new Date(),
            0.8,
            true,
          ],
        );
      }

      const response = await request(app).get(`/api/gmail/emails/${userId}?limit=3`);

      expect(response.status).toBe(200);
      expect(response.body.emails).toHaveLength(3);
      expect(response.body.total).toBe(3);
    });
  });
});
