import { google } from 'googleapis';
import GoogleCalendar from '../models/GoogleCalendar.js';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL;

// Generate LLM-powered summary and draft response for calendar events
async function generateLLMCalendarSummary(eventDetails) {
  try {
    const { title, startDateTime, location, emailSubject, emailFrom, emailBody } = eventDetails;

    const prompt = `Please summarize this email and provide a draft response:

EMAIL SUBJECT: ${emailSubject}
FROM: ${emailFrom}
EMAIL BODY: ${emailBody}

CALENDAR EVENT CREATED:
- Title: ${title}
- Date: ${startDateTime}
- Location: ${location || 'Not specified'}

Respond with ONLY this JSON format (no other text):
{
  "summary": "Brief summary of the email content",
  "draftResponse": "Suggested email response to send back"
}`;

    const response = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_SMALL_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errBody}`);
    }

    const data = await response.json();

    const content =
      data.message && typeof data.message.content === 'string' ? data.message.content.trim() : null;

    if (!content) {
      throw new Error('No content received from LLM');
    }

    // Debug: Log the raw content to see what LLM is returning
    console.info(' LLM Calendar Summary Raw Response:', content);

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(content);

      // Handle normal summary format
      if (parsed.summary && parsed.draftResponse) {
        return parsed;
      }

      // Fallback if format is unexpected
      return {
        summary: content,
        draftResponse: 'Please review the calendar event and respond as appropriate.',
      };
    } catch {
      // If JSON parsing fails, return a structured response with the raw content
      return {
        summary: content,
        draftResponse: 'Please review the calendar event and respond as appropriate.',
      };
    }
  } catch (error) {
    console.error('Error generating LLM calendar summary:', error);
    return null;
  }
}

export async function createCalendarEvent(userId, eventArgs, emailSubject, emailFrom) {
  // Clean and validate event arguments
  try {
    // Parse eventArgs if it's a string
    let cleanArgs = eventArgs;
    if (typeof eventArgs === 'string') {
      try {
        cleanArgs = JSON.parse(eventArgs);
      } catch {
        console.error('❌ Failed to parse eventArgs string:', eventArgs);
        return;
      }
    }

    // Validate and fix attendees
    let attendees = [];
    if (cleanArgs.attendees) {
      // eslint-disable-next-line no-console
      console.log(
        ' Processing attendees:',
        cleanArgs.attendees,
        'Type:',
        typeof cleanArgs.attendees,
      );

      if (typeof cleanArgs.attendees === 'string') {
        // Try to parse string as JSON array first
        try {
          const parsed = JSON.parse(cleanArgs.attendees);
          // eslint-disable-next-line no-console
          console.log(' Parsed attendees JSON:', parsed, 'Is array:', Array.isArray(parsed));
          if (Array.isArray(parsed)) {
            attendees = parsed;
          } else {
            attendees = [parsed]; // Single item
          }
        } catch (parseError) {
          // eslint-disable-next-line no-console
          console.log(' Failed to parse attendees as JSON:', parseError.message);
          // If not JSON, split by comma or treat as single email
          attendees = cleanArgs.attendees.includes(',')
            ? cleanArgs.attendees.split(',').map((email) => email.trim())
            : [cleanArgs.attendees.trim()];
        }
      } else if (Array.isArray(cleanArgs.attendees)) {
        attendees = cleanArgs.attendees;
      }

      // Ensure all attendees are valid email strings
      attendees = attendees
        .filter((email) => email && typeof email === 'string' && email.trim().length > 0)
        .map((email) => email.trim());

      // eslint-disable-next-line no-console
      console.log(' Final attendees array:', attendees);
    }

    // Validate dates - only check for required fields, don't modify them
    if (!cleanArgs.startDateTime) {
      console.error('❌ Cannot create event without start time');
      return;
    }

    if (!cleanArgs.endDateTime) {
      console.error('❌ Cannot create event without end time');
      return;
    }

    // Update the cleaned args with attendees only
    eventArgs = {
      ...cleanArgs,
      attendees,
    };

    // eslint-disable-next-line no-console
    console.log('Cleaned event args:', eventArgs);
  } catch (cleanupError) {
    console.error('❌ Error cleaning event args:', cleanupError);
    return;
  }

  try {
    const hasValidTokens = await GoogleCalendar.hasValidTokens(userId);
    if (!hasValidTokens) {
      // eslint-disable-next-line no-console
      console.log('User does not have valid Google Calendar tokens, skipping event creation');
      throw new Error(
        'User does not have valid Google Calendar tokens. Please reconnect your Google Calendar account.',
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    const tokens = await GoogleCalendar.getTokens(userId);
    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Conflict detection
    const startTime = new Date(eventArgs.startDateTime);
    const endTime = new Date(eventArgs.endDateTime);
    try {
      const existing = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });
      if (existing.data.items?.length) {
        const count = existing.data.items.length;
        // eslint-disable-next-line no-console
        console.log(`CONFLICT DETECTED: ${count} event${count > 1 ? 's' : ''} at this time`);
        const conflictNote =
          `\n\nCONFLICT WARNING: ${count} existing event${count > 1 ? 's' : ''}:\n` +
          existing.data.items.map((e) => `• ${e.summary}`).join('\n');
        eventArgs.description = (eventArgs.description || '') + conflictNote;
      }
    } catch (err) {
      console.error('Error checking conflicts:', err);
    }

    // Check if this should be an all-day event (no time specified)
    const isAllDay = !eventArgs.startDateTime.includes('T') && !eventArgs.endDateTime.includes('T');

    const event = {
      summary: eventArgs.title,
      description:
        eventArgs.description ||
        `Created from email: ${emailSubject}\n\nOriginal email from: ${emailFrom}`,
      location: eventArgs.location,
      attendees: eventArgs.attendees?.map((email) => ({ email })) || [],
    };

    if (isAllDay) {
      // All-day event: use date format, end date is next day
      const startDate = eventArgs.startDateTime.split('T')[0]; // Get YYYY-MM-DD part
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      const endDateStr = endDate.toISOString().split('T')[0];

      event.start = { date: startDate };
      event.end = { date: endDateStr };
    } else {
      // Regular event with time
      event.start = { dateTime: startTime.toISOString(), timeZone: 'America/Los_Angeles' };
      event.end = { dateTime: endTime.toISOString(), timeZone: 'America/Los_Angeles' };
    }

    const res = await calendar.events.insert({ calendarId: 'primary', resource: event });
    // eslint-disable-next-line no-console
    console.log(`✅ Event created: ${res.data.htmlLink}`);
    return res.data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    if (error.response) console.error('API details:', error.response.data);
    throw error;
  }
}

async function getMcpSessionId() {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: {
            name: 'thunderclient-test',
            version: '1.0.0',
          },
        },
        id: 1,
      }),
    });

    return response.headers.get('mcp-session-id');
  } catch (error) {
    console.error('Failed to get MCP session ID:', error);
    return null;
  }
}

// Helper function to extract data from SSE chunks
function extractFromSSEChunk(chunk, extractFn) {
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (line.startsWith('data:')) {
      const jsonStr = line.slice(5).trim();
      if (jsonStr === '[DONE]') {
        return { done: true };
      }
      if (jsonStr) {
        try {
          const event = JSON.parse(jsonStr);
          const result = extractFn(event);
          if (result !== null) {
            return { data: result };
          }
        } catch (err) {
          console.error('Bad JSON in SSE chunk:', err, jsonStr);
        }
      }
    }
  }
  return null;
}

async function getToolsFromMcpServer() {
  try {
    const sessionId = await getMcpSessionId();

    const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tools = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const result = extractFromSSEChunk(part, (event) => {
          if (event.result?.tools) {
            return event.result.tools;
          }
          console.info('Other event:', event);
          return null;
        });

        if (result?.done) {
          return tools;
        }
        if (result?.data) {
          tools = result.data;
        }
      }
    }
    return tools;
  } catch (error) {
    console.error('Failed to get tools from MCP server:', error);
    return [];
  }
}

async function executeToolViaMcp(toolCall, userId) {
  try {
    const sessionId = await getMcpSessionId();

    const args =
      typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;

    args.userId = userId;

    const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',

        'Mcp-Session-Id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolCall.function.name,
          arguments: args,
        },
        id: 2,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const chunkResult = extractFromSSEChunk(part, (event) => {
          if (event.result) {
            return event.result;
          }
          return null;
        });

        if (chunkResult?.done) {
          return result;
        }
        if (chunkResult?.data) {
          result = chunkResult.data;
        }
      }
    }

    return result;
  } catch (error) {
    console.error('MCP tool execution failed:', error);
    return null;
  }
}

// Email analysis with Ollama
export async function analyzeEmailWithLLM(subject, body, from, userId = null) {
  const currentYear = new Date().getFullYear();
  const systemPrompt = `You are an email analysis agent. You must ALWAYS return valid JSON in this exact format, even when using tools:

{
  "isWebDevRelated": true/false,
  "category": "job_application|job_rejection|job_acceptance|job_interview|job_offer|event|learning|tools|networking|newsletter|community|freelance|other",
  "priority": "high|medium|low", 
  "summary": "Brief summary of the email content",
  "actionItems": ["action1", "action2"],
  "sentiment": "positive|negative|neutral",
  "draftResponse": "Suggested response"
}

IMPORTANT: You must return this JSON structure in your response content AND use tools when needed. Do both, not one or the other.

CALENDAR EVENTS: Only create calendar events for emails with:
1. Clear appointment keywords (appointment, meeting, interview, doctor, dentist, call scheduled)
2. Specific date mentioned (time is optional)
3. Actual scheduling context (not newsletters/job listings)

NEVER create events for: job newsletters, marketing emails, general announcements, or notifications.

When creating calendar events:
- If date AND time are specified: create regular timed event
- If only date is specified: create all-day event (use date format like "2025-09-26" for startDateTime and "2025-09-27" for endDateTime)
- Use current year ${currentYear}. If a date appears to be in the past, assume next year.

Focus on web development emails: jobs, interviews, tech events, learning platforms, tools, developer community content.`;

  // Define the calendar event creation tool

  const userPrompt = `Analyze this email:\nSubject: ${subject}\nBody: ${body}\nFrom: ${from}`;

  const mcpTools = await getToolsFromMcpServer();

  const tools = mcpTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || tool.title || 'No description',
      parameters: tool.inputSchema || {},
    },
  }));

  // Client-side timeout
  const controller = new AbortController();
  const clientTimeout = setTimeout(() => controller.abort(), 20 * 60 * 1000); // 20m

  try {
    const payload = {
      model: process.env.OLLAMA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools,
      keep_alive: '20m',
      options: { temperature: 0.3, top_p: 0.9 },
      stream: false,
    };

    const response = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(clientTimeout);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errBody}`);
    }

    const data = await response.json();
    const raw =
      data.message && typeof data.message.content === 'string'
        ? data.message.content.trim()
        : JSON.stringify(data);
    const toolsCalled = data.message?.tool_calls || [];

    // Track calendar events created
    const calendarEvents = [];

    // If we have tool calls but empty content, skip fallback - let LLM calendar summary handle it
    if (toolsCalled.length > 0 && (!raw || raw === '')) {
      console.info(' Tool calls detected with empty content - will use LLM calendar summary');
      // Don't generate fallback - let the LLM calendar summary be used instead
    }
    // Invoke calendar tool with safety checks
    if (userId && toolsCalled.length) {
      // Safety check: Don't create calendar events for job newsletters
      const emailContent = `${subject} ${body} ${from}`.toLowerCase();
      const isJobNewsletter =
        emailContent.includes('job matches') ||
        emailContent.includes('job recommendations') ||
        emailContent.includes('builtin') ||
        emailContent.includes('built in') ||
        emailContent.includes('linkedin') ||
        emailContent.includes('indeed') ||
        emailContent.includes('newsletter') ||
        emailContent.includes('unsubscribe') ||
        emailContent.includes('update email frequency') ||
        emailContent.includes('job preferences') ||
        emailContent.includes('salary') ||
        emailContent.includes('remote') ||
        emailContent.includes('hybrid') ||
        (emailContent.includes('job') && emailContent.includes('board'));

      if (isJobNewsletter) {
        // eslint-disable-next-line no-console
        console.log('🚫 BLOCKED: Preventing calendar event creation for job newsletter');
        // eslint-disable-next-line no-console
        console.log(' Email subject:', subject);
        // eslint-disable-next-line no-console
        console.log(' Email from:', from);
      } else {
        for (const call of toolsCalled) {
          // eslint-disable-next-line no-console
          console.log(' Individual tool call:', JSON.stringify(call, null, 2));
          try {
            if (call.function && call.function.name === 'create_calendar_event') {
              let args = call.function.arguments;

              // Parse arguments if they're a string
              if (typeof args === 'string') {
                try {
                  args = JSON.parse(args);
                } catch (parseError) {
                  console.error('❌ Failed to parse tool call arguments:', parseError);
                  continue;
                }
              }

              const mcpResult = await executeToolViaMcp(call, userId);

              // Capture calendar event data if creation was successful
              if (mcpResult && mcpResult.content) {
                const content = mcpResult.content[0];
                if (content.eventLink) {
                  calendarEvents.push({
                    title: content.calendarEvent,
                    link: content.eventLink,
                    startTime: args.startDateTime,
                    endTime: args.endDateTime,
                    location: args.location,
                  });
                  console.info('✅ Calendar event captured via MCP:', content.eventLink);

                  // Generate LLM-powered summary and draft response for the calendar event
                  try {
                    console.info('Generate email summary');
                    const summary = await generateLLMCalendarSummary({
                      title: args.title,
                      startDateTime: args.startDateTime,
                      endDateTime: args.endDateTime,
                      location: args.location,
                      attendees: args.attendees,
                      eventLink: content.eventLink,
                      emailSubject: subject,
                      emailFrom: from,
                      emailBody: body,
                    });

                    if (summary) {
                      calendarEvents[calendarEvents.length - 1].summary = summary;
                      console.info('✅ LLM calendar summary generated');
                    }
                  } catch (summaryError) {
                    console.error('❌ Failed to generate LLM calendar summary:', summaryError);
                  }
                }
              }
            } else {
              // eslint-disable-next-line no-console
              console.log('⚠️ Unknown tool call structure or function name');
            }
          } catch (error) {
            console.error('❌ Error invoking tool call:', error);

            // Check if this is a token expiration error
            if (
              error.message &&
              error.message.includes('User does not have valid Google Calendar tokens')
            ) {
              console.info('🔑 Google Calendar token expired - this will be handled by the UI');
              // Don't throw here, just log and continue - the UI will handle the token refresh
            }
          }
        }
      }
    }

    // Handle the two different response types from Ollama
    if (toolsCalled.length > 0) {
      // When tools are used, Ollama returns empty content - use fallback logic
      console.info('Tool calls detected - using fallback analysis structure');
    } else if (raw && raw.trim() !== '') {
      // When no tools are used, Ollama returns JSON content - parse it
      try {
        console.info('raw =========================', raw);
        const cleanedRaw = raw.trim();
        const parsed = JSON.parse(cleanedRaw);

        // Add calendar events to the parsed analysis
        if (calendarEvents.length > 0) {
          parsed.calendarEvents = calendarEvents;
        }

        return parsed;
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Raw response that failed to parse:', raw);
      }
    }

    // Fallback logic for when tools are used OR JSON parsing fails
    console.info('Using fallback analysis structure');

    // Generate actual analysis from the email content
    const emailContent = `${subject} ${body}`.toLowerCase();

    // Determine if web dev related
    const webDevKeywords = [
      'developer',
      'programming',
      'code',
      'software',
      'tech',
      'javascript',
      'react',
      'node',
      'api',
      'frontend',
      'backend',
      'fullstack',
      'web development',
      'coding',
      'github',
      'git',
    ];
    const isWebDevRelated = webDevKeywords.some((keyword) => emailContent.includes(keyword));

    // Determine category
    let category = 'other';
    if (emailContent.includes('interview') || emailContent.includes('meeting'))
      category = 'job_interview';
    else if (
      emailContent.includes('job') &&
      (emailContent.includes('offer') || emailContent.includes('congratulations'))
    )
      category = 'job_offer';
    else if (
      emailContent.includes('job') &&
      (emailContent.includes('application') || emailContent.includes('apply'))
    )
      category = 'job_application';
    else if (emailContent.includes('rejected') || emailContent.includes('unfortunately'))
      category = 'job_rejection';
    else if (
      emailContent.includes('event') ||
      emailContent.includes('meetup') ||
      emailContent.includes('conference')
    )
      category = 'event';
    else if (emailContent.includes('newsletter') || emailContent.includes('update'))
      category = 'newsletter';

    // Determine priority
    const highPriorityKeywords = ['urgent', 'asap', 'immediate', 'interview', 'offer', 'deadline'];
    const priority = highPriorityKeywords.some((keyword) => emailContent.includes(keyword))
      ? 'high'
      : 'medium';

    // Generate summary
    let summary = `Email from ${from} regarding ${subject}`;
    let draftResponse = null;

    // Check if we have LLM calendar summary from calendar events
    console.info('Calendar events array:', JSON.stringify(calendarEvents, null, 2));

    if (calendarEvents.length > 0 && calendarEvents[calendarEvents.length - 1].summary) {
      const llmSummary = calendarEvents[calendarEvents.length - 1].summary;
      summary = llmSummary.summary || summary;
      draftResponse = llmSummary.draftResponse || null;
      console.info('Using LLM calendar summary:', summary);
    } else {
      console.info('No LLM calendar summary found in calendar events');
    }

    // Generate action items
    const actionItems = [];
    if (category === 'job_interview') actionItems.push('Prepare for interview');
    if (category === 'job_offer') actionItems.push('Review offer details', 'Respond to offer');
    if (calendarEvents.length > 0) actionItems.push('Calendar event created');

    const analysis = {
      summary,
      actionItems,
      sentiment: 'neutral',
      isWebDevRelated,
      category,
      priority,
      draftResponse,
    };

    // Add calendar events if any were created
    if (calendarEvents.length > 0) {
      analysis.calendarEvents = calendarEvents;
    }

    return analysis;
  } catch (err) {
    console.error('LLM analysis error:', err);
    return { summary: 'Analysis failed', actionItems: [], sentiment: 'neutral' };
  }
}
