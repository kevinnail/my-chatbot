import setup, { pool, cleanup } from '../../test-setup.js';
import EmailMemory from '../../lib/models/EmailMemory.js';
import { jest, describe, beforeEach, afterAll, it, expect } from '@jest/globals';

// Mock the Ollama API
global.fetch = jest.fn();

describe('EmailMemory model', () => {
  beforeEach(async () => {
    await setup();

    // Mock fetch for Ollama embedding API
    fetch.mockClear();
    fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          embeddings: [new Array(1024).fill(0.1)],
        }),
    });
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await cleanup();
  });

  describe('storeEmail', () => {
    it('should store an email with embedding', async () => {
      const emailData = {
        userId: 'test_user_store',
        emailId: 'email_123',
        subject: 'Test Email Subject',
        sender: 'test@example.com',
        body: 'This is a test email body',
        emailDate: new Date(),
        similarityScore: 0.85,
      };

      const result = await EmailMemory.storeEmail(emailData);

      expect(result).toHaveProperty('id');

      const { rows } = await pool.query(
        'SELECT * FROM email_memory WHERE user_id = $1 AND email_id = $2',
        [emailData.userId, emailData.emailId],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        user_id: emailData.userId,
        email_id: emailData.emailId,
        subject: expect.stringMatching(/^U2FsdGVkX1/), // Encrypted subject
        sender: expect.stringMatching(/^U2FsdGVkX1/), // Encrypted sender
        body: expect.stringMatching(/^U2FsdGVkX1/), // Encrypted body
        similarity_score: emailData.similarityScore,
        is_web_dev_related: false,
        category: 'other',
        priority: 'medium',
        sentiment: 'neutral',
        llm_analyzed: false,
      });
    });

    it('should store an email with LLM analysis', async () => {
      const llmAnalysis = {
        isWebDevRelated: true,
        category: 'technical',
        priority: 'high',
        sentiment: 'positive',
        actionItems: ['Review code', 'Deploy changes'],
      };

      const emailData = {
        userId: 'test_user_analysis',
        emailId: 'email_456',
        subject: 'React Component Update',
        sender: 'developer@company.com',
        body: 'Updated the React component as requested',
        emailDate: new Date(),
        similarityScore: 0.92,
        llmAnalysis,
      };

      await EmailMemory.storeEmail(emailData);

      const { rows } = await pool.query(
        'SELECT * FROM email_memory WHERE user_id = $1 AND email_id = $2',
        [emailData.userId, emailData.emailId],
      );

      expect(rows[0]).toMatchObject({
        is_web_dev_related: true,
        category: 'technical',
        priority: 'high',
        sentiment: 'positive',
        llm_analyzed: true,
      });
      expect(rows[0].action_items).toEqual(['Review code', 'Deploy changes']);
      expect(rows[0].llm_analysis).toEqual(llmAnalysis);
    });

    it('should update existing email on conflict', async () => {
      const emailData = {
        userId: 'test_user_update',
        emailId: 'email_789',
        subject: 'Original Subject',
        sender: 'original@example.com',
        body: 'Original body',
        emailDate: new Date(),
        similarityScore: 0.5,
      };

      // Store initial email
      await EmailMemory.storeEmail(emailData);

      // Update with new data
      const updatedData = {
        ...emailData,
        subject: 'Updated Subject',
        sender: 'updated@example.com',
        body: 'Updated body',
        similarityScore: 0.8,
      };

      await EmailMemory.storeEmail(updatedData);

      const { rows } = await pool.query(
        'SELECT * FROM email_memory WHERE user_id = $1 AND email_id = $2',
        [emailData.userId, emailData.emailId],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        subject: expect.stringMatching(/^U2FsdGVkX1/), // Encrypted subject
        sender: expect.stringMatching(/^U2FsdGVkX1/), // Encrypted sender
        body: expect.stringMatching(/^U2FsdGVkX1/), // Encrypted body
        similarity_score: 0.8,
      });
    });

    it('should detect appointment-related emails', async () => {
      const appointmentEmail = {
        userId: 'test_user_appointment',
        emailId: 'appointment_123',
        subject: 'Doctor Appointment Confirmation',
        sender: 'clinic@example.com',
        body: 'Your appointment is scheduled for tomorrow',
        emailDate: new Date(),
        similarityScore: 0.3,
      };

      await EmailMemory.storeEmail(appointmentEmail);

      const { rows } = await pool.query(
        'SELECT * FROM email_memory WHERE user_id = $1 AND email_id = $2',
        [appointmentEmail.userId, appointmentEmail.emailId],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].subject).toMatch(/^U2FsdGVkX1/); // Encrypted subject
    });
  });

  describe('emailExists', () => {
    it('should return true for existing email', async () => {
      const emailData = {
        userId: 'test_user_exists',
        emailId: 'existing_email',
        subject: 'Test Subject',
        sender: 'test@example.com',
        body: 'Test body',
        emailDate: new Date(),
      };

      await EmailMemory.storeEmail(emailData);

      const exists = await EmailMemory.emailExists(emailData.userId, emailData.emailId);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing email', async () => {
      const exists = await EmailMemory.emailExists('non_existent_user', 'non_existent_email');
      expect(exists).toBe(false);
    });
  });

  describe('getWebDevEmails', () => {
    it('should return web dev related emails', async () => {
      const userId = 'test_user_webdev';

      // Store web dev related email
      await EmailMemory.storeEmail({
        userId,
        emailId: 'webdev_1',
        subject: 'React Update',
        sender: 'dev@company.com',
        body: 'New React features available',
        emailDate: new Date(),
        llmAnalysis: { isWebDevRelated: true, category: 'technical' },
      });

      // Store non-web dev email
      await EmailMemory.storeEmail({
        userId,
        emailId: 'other_1',
        subject: 'Personal Email',
        sender: 'friend@example.com',
        body: 'How are you doing?',
        emailDate: new Date(),
        llmAnalysis: { isWebDevRelated: false, category: 'personal' },
      });

      const webDevEmails = await EmailMemory.getWebDevEmails({ userId, limit: 10 });

      expect(webDevEmails).toHaveLength(1);
      expect(webDevEmails[0]).toMatchObject({
        email_id: 'webdev_1',
        subject: 'React Update',
        category: 'technical',
      });
    });

    it('should respect limit parameter', async () => {
      const userId = 'test_user_limit';

      // Store multiple web dev emails
      for (let i = 1; i <= 5; i++) {
        await EmailMemory.storeEmail({
          userId,
          emailId: `webdev_${i}`,
          subject: `Web Dev Email ${i}`,
          sender: 'dev@company.com',
          body: `Web development content ${i}`,
          emailDate: new Date(),
          llmAnalysis: { isWebDevRelated: true },
        });
      }

      const webDevEmails = await EmailMemory.getWebDevEmails({ userId, limit: 3 });

      expect(webDevEmails).toHaveLength(3);
    });

    it('should filter by date when since parameter is provided', async () => {
      const userId = 'test_user_since';
      const pastDate = new Date('2023-01-01');
      const recentDate = new Date();

      // Store old email
      await EmailMemory.storeEmail({
        userId,
        emailId: 'old_email',
        subject: 'Old Web Dev Email',
        sender: 'dev@company.com',
        body: 'Old content',
        emailDate: pastDate,
        llmAnalysis: { isWebDevRelated: true },
      });

      // Store recent email
      await EmailMemory.storeEmail({
        userId,
        emailId: 'recent_email',
        subject: 'Recent Web Dev Email',
        sender: 'dev@company.com',
        body: 'Recent content',
        emailDate: recentDate,
        llmAnalysis: { isWebDevRelated: true },
      });

      const sinceDate = new Date('2023-06-01');
      const webDevEmails = await EmailMemory.getWebDevEmails({ userId, since: sinceDate });

      expect(webDevEmails).toHaveLength(1);
      expect(webDevEmails[0].email_id).toBe('recent_email');
    });
  });

  describe('getEmailsNeedingAnalysis', () => {
    it('should not return already analyzed emails', async () => {
      const userId = 'test_user_analyzed';
      const minSimilarity = 0.8;

      await EmailMemory.storeEmail({
        userId,
        emailId: 'analyzed_email',
        subject: 'Already Analyzed',
        sender: 'test@example.com',
        body: 'This was already analyzed',
        emailDate: new Date(),
        similarityScore: 0.9,
        llmAnalysis: { isWebDevRelated: true },
      });

      const emailsNeedingAnalysis = await EmailMemory.getEmailsNeedingAnalysis({
        userId,
        minSimilarity,
        limit: 10,
      });

      expect(emailsNeedingAnalysis).toHaveLength(0);
    });
  });

  describe('updateEmailAnalysis', () => {
    it('should update email with LLM analysis', async () => {
      const userId = 'test_user_update_analysis';
      const emailId = 'email_to_update';

      // Store initial email
      await EmailMemory.storeEmail({
        userId,
        emailId,
        subject: 'Email to Analyze',
        sender: 'test@example.com',
        body: 'This needs analysis',
        emailDate: new Date(),
        similarityScore: 0.9,
      });

      const llmAnalysis = {
        isWebDevRelated: true,
        category: 'bug-report',
        priority: 'urgent',
        sentiment: 'negative',
        actionItems: ['Fix bug', 'Deploy fix'],
      };

      const result = await EmailMemory.updateEmailAnalysis(userId, emailId, llmAnalysis);

      expect(result).toHaveProperty('id');

      const { rows } = await pool.query(
        'SELECT * FROM email_memory WHERE user_id = $1 AND email_id = $2',
        [userId, emailId],
      );

      expect(rows[0]).toMatchObject({
        is_web_dev_related: true,
        category: 'bug-report',
        priority: 'urgent',
        sentiment: 'negative',
        llm_analyzed: true,
      });
      expect(rows[0].action_items).toEqual(['Fix bug', 'Deploy fix']);
      expect(rows[0].llm_analysis).toEqual(llmAnalysis);
    });
  });

  describe('getEmailById', () => {
    it('should return email by ID', async () => {
      const userId = 'test_user_get_by_id';
      const emailId = 'specific_email';

      const emailData = {
        userId,
        emailId,
        subject: 'Specific Email',
        sender: 'sender@example.com',
        body: 'Specific email body',
        emailDate: new Date(),
        similarityScore: 0.7,
        llmAnalysis: { isWebDevRelated: true, category: 'feature-request' },
      };

      await EmailMemory.storeEmail(emailData);

      const retrievedEmail = await EmailMemory.getEmailById(userId, emailId);

      expect(retrievedEmail).toMatchObject({
        email_id: emailId,
        subject: 'Specific Email',
        sender: 'sender@example.com',
        body: 'Specific email body',
        similarity_score: 0.7,
        llm_analyzed: true,
      });
      expect(retrievedEmail.llm_analysis).toEqual(emailData.llmAnalysis);
    });

    it('should return undefined for non-existent email', async () => {
      const retrievedEmail = await EmailMemory.getEmailById(
        'non_existent_user',
        'non_existent_email',
      );
      expect(retrievedEmail).toBeUndefined();
    });
  });
});
