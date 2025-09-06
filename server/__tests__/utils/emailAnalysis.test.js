import { jest } from '@jest/globals';

// Mock dependencies BEFORE importing the module under test
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockGoogleAuth = {
  setCredentials: jest.fn(),
};

const mockCalendar = {
  events: {
    list: jest.fn(),
    insert: jest.fn(),
  },
};

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(() => mockGoogleAuth),
    },
    calendar: jest.fn(() => mockCalendar),
  },
}));

const mockGoogleCalendar = {
  hasValidTokens: jest.fn(),
  getTokens: jest.fn(),
};

jest.mock('../../lib/models/GoogleCalendar.js', () => ({
  default: mockGoogleCalendar,
}));

// Now import the module under test
import { analyzeEmailWithLLM } from '../../lib/utils/emailAnalysis.js';

// Mock environment variables
const originalEnv = process.env;

describe('emailAnalysis utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      OLLAMA_MODEL: 'test-model',
      OLLAMA_URL: 'http://localhost:11434',
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'test-redirect-uri',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('analyzeEmailWithLLM', () => {
    const mockEmailData = {
      subject: 'Test Job Application Response',
      body: 'Thank you for your application for the Software Engineer position.',
      from: 'hr@techcompany.com',
    };

    it('should analyze email and return structured response', async () => {
      const mockResponse = {
        message: {
          content: JSON.stringify({
            isWebDevRelated: true,
            category: 'job_application',
            priority: 'high',
            summary: 'Job application response',
            actionItems: ['Follow up on application'],
            sentiment: 'positive',
            draftResponse: null,
          }),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeEmailWithLLM(
        mockEmailData.subject,
        mockEmailData.body,
        mockEmailData.from,
      );

      expect(result).toMatchObject({
        isWebDevRelated: true,
        category: 'job_application',
        priority: 'high',
        summary: 'Job application response',
        actionItems: ['Follow up on application'],
        sentiment: 'positive',
        draftResponse: null,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(mockEmailData.subject),
        }),
      );
    });

    it('should handle LLM API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      const result = await analyzeEmailWithLLM(
        mockEmailData.subject,
        mockEmailData.body,
        mockEmailData.from,
      );

      expect(result).toEqual({
        summary: 'Analysis failed',
        actionItems: [],
        sentiment: 'neutral',
      });
    });

    it('should handle invalid JSON responses with fallback', async () => {
      const mockResponse = {
        message: {
          content: 'Invalid JSON response that cannot be parsed',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeEmailWithLLM(
        mockEmailData.subject,
        mockEmailData.body,
        mockEmailData.from,
      );

      expect(result).toMatchObject({
        summary: expect.stringContaining('Invalid JSON response'),
        actionItems: [],
        sentiment: 'neutral',
        isWebDevRelated: false,
        category: 'other',
        priority: 'low',
        draftResponse: null,
      });
    });

    it('should extract JSON from mixed content responses', async () => {
      const mockResponse = {
        message: {
          content:
            'Here is the analysis: {"isWebDevRelated": true, "category": "job_offer", "priority": "high", "summary": "Job offer received", "actionItems": ["Review offer"], "sentiment": "positive", "draftResponse": null} - end of analysis',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeEmailWithLLM(
        mockEmailData.subject,
        mockEmailData.body,
        mockEmailData.from,
      );

      expect(result).toMatchObject({
        isWebDevRelated: true,
        category: 'job_offer',
        priority: 'high',
        summary: 'Job offer received',
        actionItems: ['Review offer'],
        sentiment: 'positive',
        draftResponse: null,
      });
    });

    it.skip('should create calendar events for appointment emails', async () => {
      // Set up mocks BEFORE calling the function
      mockGoogleCalendar.hasValidTokens.mockResolvedValue(true);
      mockGoogleCalendar.getTokens.mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
      });
      mockCalendar.events.list.mockResolvedValue({ data: { items: [] } });

      const mockEventResult = {
        htmlLink: 'https://calendar.google.com/event/123',
        summary: 'Doctor Appointment',
        start: { dateTime: '2024-01-15T10:00:00' },
        end: { dateTime: '2024-01-15T11:00:00' },
        location: 'Healthcare Clinic',
      };
      mockCalendar.events.insert.mockResolvedValue({ data: mockEventResult });

      const appointmentEmail = {
        subject: 'Doctor Appointment Confirmation',
        body: 'Your appointment is scheduled for January 15, 2024 at 10:00 AM',
        from: 'clinic@healthcare.com',
      };

      const mockResponse = {
        message: {
          content: '',
          tool_calls: [
            {
              function: {
                name: 'create_calendar_event',
                arguments: JSON.stringify({
                  title: 'Doctor Appointment',
                  startDateTime: '2024-01-15T10:00:00',
                  endDateTime: '2024-01-15T11:00:00',
                  location: 'Healthcare Clinic',
                  attendees: ['clinic@healthcare.com'],
                }),
              },
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeEmailWithLLM(
        appointmentEmail.subject,
        appointmentEmail.body,
        appointmentEmail.from,
        'test-user',
      );

      expect(result.calendarEvents).toHaveLength(1);
      expect(result.calendarEvents[0]).toMatchObject({
        title: 'Doctor Appointment',
        link: 'https://calendar.google.com/event/123',
        startTime: '2024-01-15T10:00:00',
        endTime: '2024-01-15T11:00:00',
        location: 'Healthcare Clinic',
      });

      expect(mockCalendar.events.insert).toHaveBeenCalledWith({
        calendarId: 'primary',
        resource: expect.objectContaining({
          summary: 'Doctor Appointment',
          start: { dateTime: '2024-01-15T10:00:00', timeZone: 'America/Los_Angeles' },
          end: { dateTime: '2024-01-15T11:00:00', timeZone: 'America/Los_Angeles' },
        }),
      });
    });

    it('should prevent calendar event creation for job newsletters', async () => {
      const newsletterEmail = {
        subject: 'Weekly Job Matches - Built In',
        body: 'Here are your job recommendations for this week. Software Engineer positions available.',
        from: 'jobs@builtin.com',
      };

      const mockResponse = {
        message: {
          content: '',
          tool_calls: [
            {
              function: {
                name: 'create_calendar_event',
                arguments: JSON.stringify({
                  title: 'Job Newsletter Review',
                  startDateTime: '2024-01-15T10:00:00',
                  endDateTime: '2024-01-15T11:00:00',
                }),
              },
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeEmailWithLLM(
        newsletterEmail.subject,
        newsletterEmail.body,
        newsletterEmail.from,
        'test-user',
      );

      expect(mockCalendar.events.insert).not.toHaveBeenCalled();
      expect(result.category).toBe('newsletter');
      expect(result.priority).toBe('low');
    });

    it.skip('should handle calendar conflict detection', async () => {
      // Set up mocks BEFORE calling the function
      mockGoogleCalendar.hasValidTokens.mockResolvedValue(true);
      mockGoogleCalendar.getTokens.mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
      });

      const conflictingEvents = [
        { summary: 'Existing Meeting 1' },
        { summary: 'Existing Meeting 2' },
      ];
      mockCalendar.events.list.mockResolvedValue({ data: { items: conflictingEvents } });
      mockCalendar.events.insert.mockResolvedValue({
        data: {
          htmlLink: 'https://calendar.google.com/event/123',
          summary: 'Team Meeting',
          start: { dateTime: '2024-01-15T14:00:00' },
          end: { dateTime: '2024-01-15T15:00:00' },
        },
      });

      const appointmentEmail = {
        subject: 'Meeting Confirmation',
        body: 'Meeting scheduled for January 15, 2024 at 2:00 PM',
        from: 'colleague@company.com',
      };

      const mockResponse = {
        message: {
          content: '',
          tool_calls: [
            {
              function: {
                name: 'create_calendar_event',
                arguments: JSON.stringify({
                  title: 'Team Meeting',
                  startDateTime: '2024-01-15T14:00:00',
                  endDateTime: '2024-01-15T15:00:00',
                }),
              },
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // eslint-disable-next-line no-unused-vars
      const result = await analyzeEmailWithLLM(
        appointmentEmail.subject,
        appointmentEmail.body,
        appointmentEmail.from,
        'test-user',
      );

      expect(mockCalendar.events.insert).toHaveBeenCalledWith({
        calendarId: 'primary',
        resource: expect.objectContaining({
          description: expect.stringContaining('CONFLICT WARNING: 2 existing events'),
        }),
      });
    });

    it('should handle missing user tokens gracefully', async () => {
      mockGoogleCalendar.hasValidTokens.mockResolvedValue(false);

      const appointmentEmail = {
        subject: 'Appointment Confirmation',
        body: 'Your appointment is scheduled for tomorrow at 10 AM',
        from: 'service@provider.com',
      };

      const mockResponse = {
        message: {
          content: '',
          tool_calls: [
            {
              function: {
                name: 'create_calendar_event',
                arguments: JSON.stringify({
                  title: 'Service Appointment',
                  startDateTime: '2024-01-15T10:00:00',
                  endDateTime: '2024-01-15T11:00:00',
                }),
              },
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // eslint-disable-next-line no-unused-vars
      const result = await analyzeEmailWithLLM(
        appointmentEmail.subject,
        appointmentEmail.body,
        appointmentEmail.from,
        'test-user',
      );

      expect(mockCalendar.events.insert).not.toHaveBeenCalled();
      expect(mockGoogleCalendar.getTokens).not.toHaveBeenCalled();
    });

    it('should handle malformed tool call arguments', async () => {
      const mockResponse = {
        message: {
          content: '',
          tool_calls: [
            {
              function: {
                name: 'create_calendar_event',
                arguments: 'invalid json string',
              },
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeEmailWithLLM(
        mockEmailData.subject,
        mockEmailData.body,
        mockEmailData.from,
        'test-user',
      );

      expect(mockCalendar.events.insert).not.toHaveBeenCalled();
      expect(result.category).toBe('event');
    });

    it('should handle network timeouts', async () => {
      jest.useFakeTimers();

      const mockAbortController = {
        abort: jest.fn(),
        signal: { aborted: false },
      };
      global.AbortController = jest.fn(() => mockAbortController);

      mockFetch.mockImplementation(
        () =>
          // eslint-disable-next-line no-unused-vars
          new Promise((resolve) => {
            // Never resolve to simulate timeout
          }),
      );
      // eslint-disable-next-line no-unused-vars
      const analysisPromise = analyzeEmailWithLLM(
        mockEmailData.subject,
        mockEmailData.body,
        mockEmailData.from,
      );

      // Fast forward time to trigger timeout
      jest.advanceTimersByTime(20 * 60 * 1000 + 1000); // 20 minutes + 1 second

      expect(mockAbortController.abort).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should handle function call format with embedded JSON', async () => {
      const mockResponse = {
        message: {
          content: JSON.stringify({
            isWebDevRelated: true,
            category: 'job_interview',
            priority: 'high',
            summary: 'Interview scheduled',
            actionItems: ['Prepare for interview'],
            sentiment: 'positive',
            draftResponse: null,
          }),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeEmailWithLLM(
        mockEmailData.subject,
        mockEmailData.body,
        mockEmailData.from,
      );

      expect(result).toMatchObject({
        isWebDevRelated: true,
        category: 'job_interview',
        priority: 'high',
        summary: 'Interview scheduled',
        actionItems: ['Prepare for interview'],
        sentiment: 'positive',
        draftResponse: null,
      });
    });
  });
});
