import { jest } from '@jest/globals';
import { getEmbedding } from '../../lib/utils/ollamaEmbed.js';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ollamaEmbed utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEmbedding', () => {
    const testInput = 'This is a test input for embedding generation';

    it('should generate embedding successfully with embeddings array format', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const mockResponse = {
        embeddings: [mockEmbedding],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(testInput);

      expect(result).toBe('[0.1,0.2,0.3,0.4,0.5]');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mxbai-embed-large',
          input: testInput,
          keep_alive: '60m',
        }),
      });
    });

    it('should handle embedding field format', async () => {
      const mockEmbedding = [0.6, 0.7, 0.8, 0.9, 1.0];
      const mockResponse = {
        embedding: mockEmbedding,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(testInput);

      expect(result).toBe('[0.6,0.7,0.8,0.9,1]');
    });

    it('should handle direct array response format', async () => {
      const mockEmbedding = [1.1, 1.2, 1.3, 1.4, 1.5];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmbedding),
      });

      const result = await getEmbedding(testInput);

      expect(result).toBe('[1.1,1.2,1.3,1.4,1.5]');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(getEmbedding(testInput)).rejects.toThrow(
        'Ollama embedding API error: 500 Internal Server Error',
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network connection failed');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(getEmbedding(testInput)).rejects.toThrow('Network connection failed');
    });

    it('should handle invalid response format', async () => {
      const mockResponse = {
        // No embeddings, embedding, or array data
        someOtherField: 'invalid',
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await expect(getEmbedding(testInput)).rejects.toThrow('Invalid embedding response format');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Unexpected Ollama embedding response:',
        mockResponse,
      );
      consoleSpy.mockRestore();
    });

    it('should handle non-array embedding data', async () => {
      const mockResponse = {
        embedding: 'not an array',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await expect(getEmbedding(testInput)).rejects.toThrow('Embedding is not an array');
    });

    it('should handle empty embedding array', async () => {
      const mockResponse = {
        embedding: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(testInput);

      expect(result).toBe('[]');
    });

    it('should handle large embedding arrays', async () => {
      const largeEmbedding = Array.from({ length: 1000 }, (_, i) => i * 0.001);
      const mockResponse = {
        embedding: largeEmbedding,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(testInput);

      expect(result).toContain('[0,0.001,0.002');
      expect(result).toContain('0.999]');
      expect(result.split(',').length).toBe(1000);
    });

    it('should handle embedding with negative numbers', async () => {
      const mockEmbedding = [-0.5, -0.3, 0.2, -0.1, 0.7];
      const mockResponse = {
        embedding: mockEmbedding,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(testInput);

      expect(result).toBe('[-0.5,-0.3,0.2,-0.1,0.7]');
    });

    it('should handle embedding with very small numbers', async () => {
      const mockEmbedding = [1e-10, -1e-10, 0, 1e-15, -1e-15];
      const mockResponse = {
        embedding: mockEmbedding,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(testInput);

      expect(result).toBe('[1e-10,-1e-10,0,1e-15,-1e-15]');
    });

    it('should handle embedding with very large numbers', async () => {
      const mockEmbedding = [1e10, -1e10, 1e15, -1e15];
      const mockResponse = {
        embedding: mockEmbedding,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(testInput);

      expect(result).toBe('[10000000000,-10000000000,1000000000000000,-1000000000000000]');
    });

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(getEmbedding(testInput)).rejects.toThrow('Invalid JSON');
    });

    it('should handle different HTTP error codes', async () => {
      const testCases = [
        { status: 400, statusText: 'Bad Request' },
        { status: 401, statusText: 'Unauthorized' },
        { status: 403, statusText: 'Forbidden' },
        { status: 404, statusText: 'Not Found' },
        { status: 503, statusText: 'Service Unavailable' },
      ];

      for (const { status, statusText } of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status,
          statusText,
        });

        await expect(getEmbedding(testInput)).rejects.toThrow(
          `Ollama embedding API error: ${status} ${statusText}`,
        );
      }
    });

    it('should handle embeddings with decimal precision', async () => {
      const mockEmbedding = [0.123456789, 0.987654321, 0.555555555];
      const mockResponse = {
        embedding: mockEmbedding,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(testInput);

      expect(result).toBe('[0.123456789,0.987654321,0.555555555]');
    });

    it('should handle embeddings[0] format when embeddings has multiple elements', async () => {
      const mockResponse = {
        embeddings: [
          [0.1, 0.2, 0.3], // First embedding (should be used)
          [0.4, 0.5, 0.6], // Second embedding (should be ignored)
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(testInput);

      expect(result).toBe('[0.1,0.2,0.3]');
    });

    it('should handle empty string input', async () => {
      const mockEmbedding = [0.0, 0.0, 0.0];
      const mockResponse = {
        embedding: mockEmbedding,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding('');

      expect(result).toBe('[0,0,0]');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embed',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'mxbai-embed-large',
            input: '',
            keep_alive: '60m',
          }),
        }),
      );
    });

    it('should handle very long input text', async () => {
      const longInput = 'word '.repeat(10000); // Very long input
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockResponse = {
        embedding: mockEmbedding,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(longInput);

      expect(result).toBe('[0.1,0.2,0.3]');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embed',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'mxbai-embed-large',
            input: longInput,
            keep_alive: '60m',
          }),
        }),
      );
    });

    it('should handle special characters in input', async () => {
      const specialInput = 'Text with special chars: !@#$%^&*()[]{}|;:,.<>?`~"\'\\';
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockResponse = {
        embedding: mockEmbedding,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(specialInput);

      expect(result).toBe('[0.1,0.2,0.3]');
    });

    it('should handle Unicode characters in input', async () => {
      const unicodeInput = 'Text with Unicode: 你好 🌟 émojis ñañá';
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockResponse = {
        embedding: mockEmbedding,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getEmbedding(unicodeInput);

      expect(result).toBe('[0.1,0.2,0.3]');
    });

    it('should preserve error context when catching and rethrowing', async () => {
      const originalError = new Error('Original fetch error');
      originalError.code = 'NETWORK_ERROR';

      mockFetch.mockRejectedValueOnce(originalError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getEmbedding(testInput)).rejects.toThrow('Original fetch error');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/❌ Embedding generation failed after \d+\.\d+ seconds:/),
        originalError,
      );
      consoleSpy.mockRestore();
    });
  });
});
