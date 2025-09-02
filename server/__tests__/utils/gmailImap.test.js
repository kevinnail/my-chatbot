import { jest } from '@jest/globals';
import { getImapConfig, parseEmailBody } from '../../lib/utils/gmailImap.js';

// Mock environment variables
const originalEnv = process.env;

describe('gmailImap utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      GMAIL_USER: 'test@gmail.com',
      GMAIL_APP_PASSWORD: 'test-password',
      GMAIL_IMAP_HOST: 'imap.gmail.com',
      GMAIL_IMAP_PORT: '993',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getImapConfig', () => {
    it('should return proper IMAP configuration', () => {
      const config = getImapConfig();

      expect(config).toEqual({
        user: 'test@gmail.com',
        password: 'test-password',
        host: 'imap.gmail.com',
        port: '993',
        tls: true,
        tlsOptions: {
          servername: 'imap.gmail.com',
        },
      });
    });

    it('should use default values when env vars are missing', () => {
      delete process.env.GMAIL_IMAP_HOST;
      delete process.env.GMAIL_IMAP_PORT;

      const config = getImapConfig();

      expect(config.host).toBe('imap.gmail.com');
      expect(config.port).toBe(993);
    });
  });

  describe('parseEmailBody', () => {
    it('should remove HTML tags and clean up text', () => {
      const htmlBody = '<p>Hello <strong>world</strong>!</p><br><div>This is a test.</div>';
      const result = parseEmailBody(htmlBody);

      expect(result).toBe('Hello world!This is a test.');
    });

    it('should replace multiple spaces with single space', () => {
      const body = 'Hello    world   with    multiple     spaces';
      const result = parseEmailBody(body);

      expect(result).toBe('Hello world with multiple spaces');
    });

    it('should replace multiple newlines with single newline', () => {
      const body = 'Line 1\n\n\nLine 2\n\n\n\nLine 3';
      const result = parseEmailBody(body);

      expect(result).toBe('Line 1 Line 2 Line 3');
    });

    it('should limit body length to 2000 characters', () => {
      const longBody = 'a'.repeat(3000);
      const result = parseEmailBody(longBody);

      expect(result).toHaveLength(2003); // 2000 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should trim whitespace', () => {
      const body = '   Hello world   ';
      const result = parseEmailBody(body);

      expect(result).toBe('Hello world');
    });

    it('should handle empty body', () => {
      const result = parseEmailBody('');
      expect(result).toBe('');
    });

    it('should handle complex HTML structures', () => {
      const htmlBody = `
        <html>
          <head><title>Test</title></head>
          <body>
            <div class="header">
              <h1>Welcome</h1>
              <p>This is a <em>test</em> email.</p>
            </div>
            <div class="content">
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </div>
          </body>
        </html>
      `;
      const result = parseEmailBody(htmlBody);

      expect(result).toContain('Welcome');
      expect(result).toContain('This is a test email.');
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should handle mixed HTML and text content', () => {
      const mixedContent = 'Plain text <b>bold text</b> more plain text';
      const result = parseEmailBody(mixedContent);

      expect(result).toBe('Plain text bold text more plain text');
    });

    it('should handle special HTML entities', () => {
      const htmlWithEntities = 'Hello &amp; welcome to our &quot;special&quot; event!';
      const result = parseEmailBody(htmlWithEntities);

      expect(result).toBe('Hello &amp; welcome to our &quot;special&quot; event!');
    });

    it('should handle newlines and preserve meaningful line breaks', () => {
      const textWithNewlines = 'Line 1\nLine 2\n\nLine 3\n\n\n\nLine 4';
      const result = parseEmailBody(textWithNewlines);

      // Multiple newlines should be collapsed to single spaces
      expect(result).toBe('Line 1 Line 2 Line 3 Line 4');
    });

    it('should handle very short content', () => {
      const shortContent = 'Hi';
      const result = parseEmailBody(shortContent);

      expect(result).toBe('Hi');
    });

    it('should handle content at exactly 2000 characters', () => {
      const exactContent = 'a'.repeat(2000);
      const result = parseEmailBody(exactContent);

      expect(result).toHaveLength(2000);
      expect(result.endsWith('...')).toBe(false);
    });

    it('should handle content just over 2000 characters', () => {
      const justOverContent = 'a'.repeat(2001);
      const result = parseEmailBody(justOverContent);

      expect(result).toHaveLength(2003); // 2000 + '...'
      expect(result.endsWith('...')).toBe(true);
    });
  });
});
