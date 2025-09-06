import { jest } from '@jest/globals';
import {
  preFilterWebDevEmails,
  calculateCosineSimilarity,
  addEmailCategory,
  getAvailableCategories,
} from '../../lib/utils/vectorSimilarity.js';

// Mock the embedding function
const mockGetEmbedding = jest.fn();
jest.mock('../../lib/utils/ollamaEmbed.js', () => ({
  getEmbedding: mockGetEmbedding,
}));

describe('vectorSimilarity utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCosineSimilarity', () => {
    it('should calculate cosine similarity between two vectors', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [1, 0, 0];

      const similarity = calculateCosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate similarity for orthogonal vectors', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];

      const similarity = calculateCosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should calculate similarity for opposite vectors', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [-1, 0, 0];

      const similarity = calculateCosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should handle string embeddings (JSON format)', () => {
      const vector1String = '[1, 0, 0]';
      const vector2String = '[0.5, 0.866, 0]';

      const similarity = calculateCosineSimilarity(vector1String, vector2String);

      expect(similarity).toBeCloseTo(0.5, 3);
    });

    it('should handle mixed string and array inputs', () => {
      const vector1 = [1, 0, 0];
      const vector2String = '[1, 0, 0]';

      const similarity = calculateCosineSimilarity(vector1, vector2String);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should handle multi-dimensional vectors', () => {
      const vector1 = [0.1, 0.2, 0.3, 0.4, 0.5];
      const vector2 = [0.2, 0.1, 0.4, 0.3, 0.6];

      const similarity = calculateCosineSimilarity(vector1, vector2);

      // Calculate expected similarity manually
      const dotProduct = 0.1 * 0.2 + 0.2 * 0.1 + 0.3 * 0.4 + 0.4 * 0.3 + 0.5 * 0.6;
      const norm1 = Math.sqrt(0.1 * 0.1 + 0.2 * 0.2 + 0.3 * 0.3 + 0.4 * 0.4 + 0.5 * 0.5);
      const norm2 = Math.sqrt(0.2 * 0.2 + 0.1 * 0.1 + 0.4 * 0.4 + 0.3 * 0.3 + 0.6 * 0.6);
      const expected = dotProduct / (norm1 * norm2);

      expect(similarity).toBeCloseTo(expected, 5);
    });

    it('should handle zero vectors gracefully', () => {
      const vector1 = [0, 0, 0];
      const vector2 = [1, 0, 0];

      const similarity = calculateCosineSimilarity(vector1, vector2);

      // Should return 0 or NaN for zero vector (implementation dependent)
      expect(similarity).toBeNaN();
    });
  });

  describe('preFilterWebDevEmails', () => {
    const mockEmails = [
      {
        id: 1,
        subject: 'Software Engineer Position - React Developer',
        body: 'We have an exciting opportunity for a React developer with experience in JavaScript and Node.js.',
        from: 'hr@techcompany.com',
      },
      {
        id: 2,
        subject: 'Doctor Appointment Reminder',
        body: 'Your appointment with Dr. Smith is scheduled for tomorrow at 2 PM.',
        from: 'appointments@clinic.com',
      },
      {
        id: 3,
        subject: 'Newsletter: Marketing Updates',
        body: 'Here are the latest marketing trends and updates for this month.',
        from: 'newsletter@marketing.com',
      },
      {
        id: 4,
        subject: 'Frontend Developer Interview',
        body: 'Thank you for applying. We would like to schedule a technical interview for the frontend developer position.',
        from: 'recruiter@startup.com',
      },
    ];

    beforeEach(() => {
      // Mock embeddings for different categories
      mockGetEmbedding.mockImplementation((text) => {
        if (
          text.includes('web development') ||
          text.includes('React') ||
          text.includes('JavaScript')
        ) {
          return Promise.resolve('[0.8, 0.6, 0.2, 0.1, 0.3]'); // High web dev similarity
        } else if (
          text.includes('appointment') ||
          text.includes('doctor') ||
          text.includes('scheduled')
        ) {
          return Promise.resolve('[0.1, 0.2, 0.9, 0.8, 0.1]'); // High appointment similarity
        } else if (text.includes('Software Engineer') || text.includes('Frontend Developer')) {
          return Promise.resolve('[0.9, 0.7, 0.1, 0.2, 0.4]'); // High web dev similarity for job titles
        } else {
          return Promise.resolve('[0.1, 0.1, 0.1, 0.1, 0.1]'); // Low similarity for everything else
        }
      });
    });

    it('should pre-filter emails and categorize them correctly', async () => {
      const result = await preFilterWebDevEmails(mockEmails);

      expect(result).toHaveProperty('likelyWebDevEmails');
      expect(result).toHaveProperty('unlikelyEmails');
      expect(result).toHaveProperty('totalEmails', mockEmails.length);
      expect(result).toHaveProperty('reductionPercentage');

      // Should identify web dev related emails
      const webDevEmails = result.likelyWebDevEmails.filter((email) => email.likelyWebDev);
      expect(webDevEmails.length).toBeGreaterThan(0);

      // Should identify appointment emails
      const appointmentEmails = result.likelyWebDevEmails.filter(
        (email) => email.isAppointmentRelated,
      );
      expect(appointmentEmails.length).toBeGreaterThan(0);

      // Each email should have similarity scores and categories
      result.likelyWebDevEmails.forEach((email) => {
        expect(email).toHaveProperty('categoryScores');
        expect(email).toHaveProperty('primaryCategory');
        expect(email).toHaveProperty('bestScore');
        expect(email).toHaveProperty('likelyWebDev');
        expect(email).toHaveProperty('isAppointmentRelated');
        expect(email).toHaveProperty('reason');
      });
    }, 10000);

    it('should always include at least 3 emails for analysis', async () => {
      const twoEmails = mockEmails.slice(0, 2);

      const result = await preFilterWebDevEmails(twoEmails);

      expect(result.likelyWebDevEmails.length).toBe(2);
      expect(result.unlikelyEmails.length).toBe(0);
    }, 10000);

    it.skip('should handle empty email list', async () => {
      const result = await preFilterWebDevEmails([]);

      expect(result.likelyWebDevEmails).toHaveLength(0);
      expect(result.unlikelyEmails).toHaveLength(0);
      expect(result.totalEmails).toBe(0);
      expect(result.reductionPercentage).toBe(0);
    }, 10000);

    it('should sort emails by best similarity score', async () => {
      // Mock different similarity scores
      mockGetEmbedding.mockImplementation((text) => {
        if (text.includes('Software Engineer Position')) {
          return Promise.resolve('[1.0, 0.8, 0.1, 0.1, 0.2]'); // Highest score
        } else if (text.includes('Frontend Developer Interview')) {
          return Promise.resolve('[0.9, 0.7, 0.1, 0.1, 0.2]'); // Second highest
        } else if (text.includes('Doctor Appointment')) {
          return Promise.resolve('[0.1, 0.1, 0.8, 0.7, 0.1]'); // Third highest (appointment)
        } else {
          return Promise.resolve('[0.1, 0.1, 0.1, 0.1, 0.1]'); // Lowest
        }
      });

      const result = await preFilterWebDevEmails(mockEmails);

      // Should be sorted by best score descending
      for (let i = 1; i < result.likelyWebDevEmails.length; i++) {
        expect(result.likelyWebDevEmails[i - 1].bestScore).toBeGreaterThanOrEqual(
          result.likelyWebDevEmails[i].bestScore,
        );
      }
    });

    it.skip('should handle embedding errors gracefully', async () => {
      mockGetEmbedding.mockRejectedValue(new Error('Embedding service unavailable'));

      const result = await preFilterWebDevEmails(mockEmails);

      // Should fallback to processing all emails
      expect(result.likelyWebDevEmails).toHaveLength(mockEmails.length);
      expect(result.unlikelyEmails).toHaveLength(0);
      expect(result.reductionPercentage).toBe(0);
    });

    it('should calculate reduction percentage correctly', async () => {
      // Mock to make first two emails high similarity, others low
      mockGetEmbedding.mockImplementation((text) => {
        if (text.includes('Software Engineer') || text.includes('Frontend Developer')) {
          return Promise.resolve('[0.9, 0.7, 0.1, 0.1, 0.2]'); // High web dev similarity
        } else {
          return Promise.resolve('[0.1, 0.1, 0.1, 0.1, 0.1]'); // Low similarity
        }
      });

      const result = await preFilterWebDevEmails(mockEmails);

      // Should have some reduction
      expect(result.reductionPercentage).toBeGreaterThan(0);
      expect(result.reductionPercentage).toBeLessThanOrEqual(100);
    });

    it('should provide detailed logging information', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await preFilterWebDevEmails(mockEmails.slice(0, 2));

      expect(consoleSpy).toHaveBeenCalledWith('Pre-filtering emails using vector similarity...');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Vector pre-filtering results:'),
      );

      consoleSpy.mockRestore();
    });

    it('should handle single email correctly', async () => {
      const singleEmail = [mockEmails[0]];

      const result = await preFilterWebDevEmails(singleEmail);

      expect(result.likelyWebDevEmails).toHaveLength(1);
      expect(result.totalEmails).toBe(1);
      expect(result.likelyWebDevEmails[0]).toHaveProperty('categoryScores');
    });
  });

  describe('addEmailCategory', () => {
    beforeEach(() => {
      // Reset categories to initial state
      jest.resetModules();
    });

    it('should add a new email category', () => {
      const categoryName = 'test_category';
      const referenceText = 'test reference text for new category';
      const threshold = 0.6;

      addEmailCategory(categoryName, referenceText, threshold);

      const categories = getAvailableCategories();
      expect(categories).toContain(categoryName);
    });

    it('should use default threshold when not provided', () => {
      const categoryName = 'default_threshold_category';
      const referenceText = 'test reference text';

      addEmailCategory(categoryName, referenceText);

      // Category should be added (we can't directly test threshold without accessing internal state)
      const categories = getAvailableCategories();
      expect(categories).toContain(categoryName);
    });

    it('should overwrite existing category', () => {
      const categoryName = 'web_dev'; // Existing category
      const newReferenceText = 'new reference text for web dev';
      const newThreshold = 0.7;

      addEmailCategory(categoryName, newReferenceText, newThreshold);

      // Should not throw error and category should still exist
      const categories = getAvailableCategories();
      expect(categories).toContain(categoryName);
    });
  });

  describe('getAvailableCategories', () => {
    it('should return list of available categories', () => {
      const categories = getAvailableCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain('web_dev');
      expect(categories).toContain('appointment');
      expect(categories.length).toBeGreaterThanOrEqual(2);
    });

    it('should include newly added categories', () => {
      const newCategory = 'test_new_category';
      addEmailCategory(newCategory, 'test text');

      const categories = getAvailableCategories();
      expect(categories).toContain(newCategory);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed embedding strings', () => {
      const malformedString = 'not a valid json array';
      const validVector = [1, 0, 0];

      expect(() => {
        calculateCosineSimilarity(malformedString, validVector);
      }).toThrow();
    });

    it('should handle vectors of different lengths', () => {
      const vector1 = [1, 0];
      const vector2 = [1, 0, 0];

      // This should not throw but may produce unexpected results
      // The actual behavior depends on implementation
      const similarity = calculateCosineSimilarity(vector1, vector2);
      expect(typeof similarity).toBe('number');
    });

    it('should handle empty vectors', () => {
      const vector1 = [];
      const vector2 = [];

      const similarity = calculateCosineSimilarity(vector1, vector2);
      expect(similarity).toBeNaN();
    });

    it('should handle very small numbers in vectors', () => {
      const vector1 = [1e-10, 1e-10, 1e-10];
      const vector2 = [1e-10, 1e-10, 1e-10];

      const similarity = calculateCosineSimilarity(vector1, vector2);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should handle very large numbers in vectors', () => {
      const vector1 = [1e10, 1e10, 1e10];
      const vector2 = [1e10, 1e10, 1e10];

      const similarity = calculateCosineSimilarity(vector1, vector2);
      expect(similarity).toBeCloseTo(1.0, 5);
    });
  });
});
