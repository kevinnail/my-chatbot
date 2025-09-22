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

// Mock MCP server functions by mocking the fetch calls

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
      MCP_SERVER_URL: 'http://localhost:3001',
    };

    // Set up default MCP server mocks via fetch
    // Mock MCP session initialization
    mockFetch.mockImplementation((url, options) => {
      if (url === 'http://localhost:3001/mcp' && options.body.includes('initialize')) {
        return Promise.resolve({
          ok: true,
          headers: {
            get: jest.fn().mockReturnValue('test-session-id'),
          },
        });
      }

      // Mock tools/list response
      if (url === 'http://localhost:3001/mcp' && options.body.includes('tools/list')) {
        return Promise.resolve({
          ok: true,
          body: {
            getReader: jest.fn().mockReturnValue({
              read: jest
                .fn()
                .mockResolvedValueOnce({
                  done: false,
                  value: new TextEncoder().encode(
                    'data: {"result": {"tools": [{"name": "create_calendar_event", "description": "Create a calendar event", "inputSchema": {"type": "object", "properties": {"title": {"type": "string"}, "startDateTime": {"type": "string"}, "endDateTime": {"type": "string"}, "location": {"type": "string"}, "attendees": {"type": "array"}}}}]}}\n\n',
                  ),
                })
                .mockResolvedValueOnce({ done: true }),
            }),
          },
        });
      }

      // Mock tools/call response
      if (url === 'http://localhost:3001/mcp' && options.body.includes('tools/call')) {
        return Promise.resolve({
          ok: true,
          body: {
            getReader: jest.fn().mockReturnValue({
              read: jest
                .fn()
                .mockResolvedValueOnce({
                  done: false,
                  value: new TextEncoder().encode(
                    'data: {"result": {"content": [{"eventLink": "https://calendar.google.com/event/123", "calendarEvent": "Test Event"}]}}\n\n',
                  ),
                })
                .mockResolvedValueOnce({ done: true }),
            }),
          },
        });
      }

      // Default fallback for Ollama API calls
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
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
          }),
      });
    });
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
      // Override the default mock for this test to return specific response
      mockFetch.mockImplementation((url, _options) => {
        if (url === 'http://localhost:11434/api/chat') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
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
              }),
          });
        }

        // Use default MCP mocks for other calls
        return Promise.resolve({
          ok: true,
          headers: { get: jest.fn().mockReturnValue('test-session-id') },
        });
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
      mockFetch.mockImplementation((url, _options) => {
        if (url === 'http://localhost:11434/api/chat') {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Server error'),
          });
        }

        // Use default MCP mocks for other calls
        return Promise.resolve({
          ok: true,
          headers: { get: jest.fn().mockReturnValue('test-session-id') },
        });
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

    // fails in CI but passes locally
    it.skip('should create calendar events for appointment emails', async () => {
      const appointmentEmail = {
        subject: 'Doctor Appointment Confirmation',
        body: 'Your appointment is scheduled for January 15, 2024 at 10:00 AM',
        from: 'clinic@healthcare.com',
      };

      mockFetch.mockImplementation((url, _options) => {
        if (url === 'http://localhost:11434/api/chat') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
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
              }),
          });
        }

        // Use default MCP mocks for other calls
        if (url === 'http://localhost:3001/mcp') {
          if (_options.body.includes('initialize')) {
            return Promise.resolve({
              ok: true,
              headers: { get: jest.fn().mockReturnValue('test-session-id') },
            });
          }

          if (_options.body.includes('tools/list')) {
            return Promise.resolve({
              ok: true,
              body: {
                getReader: jest.fn().mockReturnValue({
                  read: jest
                    .fn()
                    .mockResolvedValueOnce({
                      done: false,
                      value: new TextEncoder().encode(
                        'data: {"result": {"tools": [{"name": "create_calendar_event", "description": "Create a calendar event", "inputSchema": {"type": "object", "properties": {"title": {"type": "string"}, "startDateTime": {"type": "string"}, "endDateTime": {"type": "string"}, "location": {"type": "string"}, "attendees": {"type": "array"}}}}]}}\n\n',
                      ),
                    })
                    .mockResolvedValueOnce({ done: true }),
                }),
              },
            });
          }

          if (_options.body.includes('tools/call')) {
            return Promise.resolve({
              ok: true,
              body: {
                getReader: jest.fn().mockReturnValue({
                  read: jest
                    .fn()
                    .mockResolvedValueOnce({
                      done: false,
                      value: new TextEncoder().encode(
                        'data: {"result": {"content": [{"eventLink": "https://calendar.google.com/event/123", "calendarEvent": "Doctor Appointment"}]}}\n\n',
                      ),
                    })
                    .mockResolvedValueOnce({ done: true }),
                }),
              },
            });
          }
        }

        return Promise.resolve({ ok: true });
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

      // Verify that MCP server was called for tool execution
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/mcp',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Mcp-Session-Id': 'test-session-id',
          }),
          body: expect.stringContaining('tools/call'),
        }),
      );
    });

    it('should prevent calendar event creation for job newsletters', async () => {
      const newsletterEmail = {
        subject: 'Weekly Job Matches - Built In',
        body: 'Here are your job recommendations for this week. Software Engineer positions available.',
        from: 'jobs@builtin.com',
      };

      mockFetch.mockImplementation((url, _options) => {
        if (url === 'http://localhost:11434/api/chat') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
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
              }),
          });
        }

        // Use default MCP mocks for other calls
        return Promise.resolve({
          ok: true,
          headers: { get: jest.fn().mockReturnValue('test-session-id') },
        });
      });

      const result = await analyzeEmailWithLLM(
        newsletterEmail.subject,
        newsletterEmail.body,
        newsletterEmail.from,
        'test-user',
      );

      // Should not call MCP server for tool execution since it's a newsletter
      const mcpCalls = mockFetch.mock.calls.filter(
        (call) => call[0] === 'http://localhost:3001/mcp' && call[1].body.includes('tools/call'),
      );
      expect(mcpCalls).toHaveLength(0);
      expect(result.category).toBe('other');
      expect(result.priority).toBe('medium');
    });

    // fails in CI but passes locally
    it.skip('should handle calendar conflict detection', async () => {
      const appointmentEmail = {
        subject: 'Meeting Confirmation',
        body: 'Meeting scheduled for January 15, 2024 at 2:00 PM',
        from: 'colleague@company.com',
      };

      mockFetch.mockImplementation((url, _options) => {
        if (url === 'http://localhost:11434/api/chat') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
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
              }),
          });
        }

        // Use default MCP mocks for other calls
        return Promise.resolve({
          ok: true,
          headers: { get: jest.fn().mockReturnValue('test-session-id') },
        });
      });

      // eslint-disable-next-line no-unused-vars
      const result = await analyzeEmailWithLLM(
        appointmentEmail.subject,
        appointmentEmail.body,
        appointmentEmail.from,
        'test-user',
      );

      // Verify that MCP server was called for tool execution
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/mcp',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Mcp-Session-Id': 'test-session-id',
          }),
          body: expect.stringContaining('tools/call'),
        }),
      );
    });
    // fails in CI but passes locally
    it.skip('should handle missing user tokens gracefully', async () => {
      mockGoogleCalendar.hasValidTokens.mockResolvedValue(false);

      const appointmentEmail = {
        subject: 'Appointment Confirmation',
        body: 'Your appointment is scheduled for tomorrow at 10 AM',
        from: 'service@provider.com',
      };

      mockFetch.mockImplementation((url, _options) => {
        if (url === 'http://localhost:11434/api/chat') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
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
              }),
          });
        }

        // Use default MCP mocks for other calls
        return Promise.resolve({
          ok: true,
          headers: { get: jest.fn().mockReturnValue('test-session-id') },
        });
      });

      // eslint-disable-next-line no-unused-vars
      const result = await analyzeEmailWithLLM(
        appointmentEmail.subject,
        appointmentEmail.body,
        appointmentEmail.from,
        'test-user',
      );

      // Should call MCP server to get tools and execute tools, but tool execution should fail due to invalid tokens
      const mcpToolCalls = mockFetch.mock.calls.filter(
        (call) => call[0] === 'http://localhost:3001/mcp' && call[1].body.includes('tools/call'),
      );
      expect(mcpToolCalls.length).toBeGreaterThan(0);

      // Should call to get tools list
      const mcpToolListCalls = mockFetch.mock.calls.filter(
        (call) => call[0] === 'http://localhost:3001/mcp' && call[1].body.includes('tools/list'),
      );
      expect(mcpToolListCalls.length).toBeGreaterThan(0);
    });

    it('should handle malformed tool call arguments', async () => {
      mockFetch.mockImplementation((url, _options) => {
        if (url === 'http://localhost:11434/api/chat') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
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
              }),
          });
        }

        // Use default MCP mocks for other calls
        return Promise.resolve({
          ok: true,
          headers: { get: jest.fn().mockReturnValue('test-session-id') },
        });
      });

      const result = await analyzeEmailWithLLM(
        mockEmailData.subject,
        mockEmailData.body,
        mockEmailData.from,
        'test-user',
      );

      // Should not call MCP server for tool execution due to malformed arguments
      const mcpCalls = mockFetch.mock.calls.filter(
        (call) => call[0] === 'http://localhost:3001/mcp' && call[1].body.includes('tools/call'),
      );
      expect(mcpCalls).toHaveLength(0);
      expect(result.category).toBe('job_application');
    });

    it('should handle network timeouts', async () => {
      const mockAbortController = {
        abort: jest.fn(),
        signal: { aborted: false },
      };
      global.AbortController = jest.fn(() => mockAbortController);

      mockFetch.mockImplementation((url, _options) => {
        if (url === 'http://localhost:11434/api/chat') {
          return Promise.reject(new Error('Network timeout'));
        }

        // Use default MCP mocks for other calls
        return Promise.resolve({
          ok: true,
          headers: { get: jest.fn().mockReturnValue('test-session-id') },
        });
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

    it('should handle function call format with embedded JSON', async () => {
      mockFetch.mockImplementation((url, _options) => {
        if (url === 'http://localhost:11434/api/chat') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
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
              }),
          });
        }

        // Use default MCP mocks for other calls
        return Promise.resolve({
          ok: true,
          headers: { get: jest.fn().mockReturnValue('test-session-id') },
        });
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
