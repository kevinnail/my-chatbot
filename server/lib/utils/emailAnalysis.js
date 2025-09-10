import { google } from 'googleapis';
import GoogleCalendar from '../models/GoogleCalendar.js';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL;

// Helper function to create calendar event
export async function createCalendarEvent(userId, eventArgs, emailSubject, emailFrom) {
  // eslint-disable-next-line no-console
  console.log('🗓️ Raw event args received:', eventArgs);

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
        '🔧 Processing attendees:',
        cleanArgs.attendees,
        'Type:',
        typeof cleanArgs.attendees,
      );

      if (typeof cleanArgs.attendees === 'string') {
        // Try to parse string as JSON array first
        try {
          const parsed = JSON.parse(cleanArgs.attendees);
          // eslint-disable-next-line no-console
          console.log('🔧 Parsed attendees JSON:', parsed, 'Is array:', Array.isArray(parsed));
          if (Array.isArray(parsed)) {
            attendees = parsed;
          } else {
            attendees = [parsed]; // Single item
          }
        } catch (parseError) {
          // eslint-disable-next-line no-console
          console.log('🔧 Failed to parse attendees as JSON:', parseError.message);
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
      console.log('🔧 Final attendees array:', attendees);
    }

    // Validate and fix dates
    const currentYear = new Date().getFullYear();
    const currentDate = new Date();

    let startDateTime = cleanArgs.startDateTime;
    let endDateTime = cleanArgs.endDateTime;

    // Fix year if it's in the past (assume next year)
    if (startDateTime) {
      const startDate = new Date(startDateTime);
      if (startDate < currentDate && startDate.getFullYear() === currentYear) {
        startDate.setFullYear(currentYear + 1);
        startDateTime = startDate.toISOString();
        // eslint-disable-next-line no-console
        console.log('🔧 Fixed start date to next year:', startDateTime);
      }
    }

    // Fix empty or invalid end date
    if (!endDateTime || endDateTime === '' || endDateTime === 'null') {
      if (startDateTime) {
        const start = new Date(startDateTime);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // Add 1 hour
        endDateTime = end.toISOString();
        // eslint-disable-next-line no-console
        console.log('🔧 Generated end date (1 hour after start):', endDateTime);
      } else {
        console.error('❌ Cannot create event without valid start/end times');
        return;
      }
    }

    // Update the cleaned args
    eventArgs = {
      ...cleanArgs,
      attendees,
      startDateTime,
      endDateTime,
    };

    // eslint-disable-next-line no-console
    console.log('🗓️ Cleaned event args:', eventArgs);
  } catch (cleanupError) {
    console.error('❌ Error cleaning event args:', cleanupError);
    return;
  }

  try {
    const hasValidTokens = await GoogleCalendar.hasValidTokens(userId);
    if (!hasValidTokens) {
      // eslint-disable-next-line no-console
      console.log('User does not have valid Google Calendar tokens, skipping event creation');
      return;
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

    const event = {
      summary: eventArgs.title,
      description:
        eventArgs.description ||
        `Created from email: ${emailSubject}\n\nOriginal email from: ${emailFrom}`,
      location: eventArgs.location,
      start: { dateTime: eventArgs.startDateTime, timeZone: 'America/Los_Angeles' },
      end: { dateTime: eventArgs.endDateTime, timeZone: 'America/Los_Angeles' },
      attendees: eventArgs.attendees?.map((email) => ({ email })) || [],
    };

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
      headers: { 'Content-Type': 'application/json' },
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

async function getToolsFromMcpServer() {
  try {
    const sessionId = await getMcpSessionId();
    const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': sessionId },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      }),
    });

    const data = await response.json();

    // Convert MCP tools to Ollama format
    return data.result.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  } catch (error) {
    console.error('Failed to get tools from MCP server:', error);
    return [];
  }
}

// Email analysis with Ollama
export async function analyzeEmailWithLLM(subject, body, from, userId = null) {
  const currentYear = new Date().getFullYear();
  const systemPrompt = `You are an email analysis agent. You must ALWAYS return valid JSON in this exact format:

{
  "isWebDevRelated": true/false,
  "category": "job_application|job_rejection|job_acceptance|job_interview|job_offer|event|learning|tools|networking|newsletter|community|freelance|other",
  "priority": "high|medium|low", 
  "summary": "Brief summary of the email content",
  "actionItems": ["action1", "action2"],
  "sentiment": "positive|negative|neutral",
  "draftResponse": "Suggested response if appropriate, or null"
}

CALENDAR EVENTS: Only create calendar events for emails with:
1. Clear appointment keywords (appointment, meeting, interview, doctor, dentist, call scheduled)
2. Specific date AND time mentioned (not copyright dates)
3. Actual scheduling context (not newsletters/job listings)

NEVER create events for: job newsletters, marketing emails, general announcements, or notifications.

When creating calendar events, use current year ${currentYear}. If a date appears to be in the past, assume next year.

Focus on web development emails: jobs, interviews, tech events, learning platforms, tools, developer community content.`;

  // Define the calendar event creation tool

  const userPrompt = `Analyze this email:\nSubject: ${subject}\nBody: ${body}\nFrom: ${from}`;

  const tools = await getToolsFromMcpServer();

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

    // console.log('🔍 Raw Ollama response:', JSON.stringify(data, null, 2));

    let raw =
      data.message && typeof data.message.content === 'string'
        ? data.message.content.trim()
        : JSON.stringify(data);
    const toolsCalled = data.message?.tool_calls || [];

    // console.log('🔍 Tool calls found:', toolsCalled);

    // Track calendar events created
    const calendarEvents = [];

    // If we have tool calls but empty content, generate a contextual analysis
    if (toolsCalled.length > 0 && (!raw || raw === '')) {
      // eslint-disable-next-line no-console
      console.log('🔧 Empty content with tool calls detected, generating contextual analysis');

      // Determine category based on email content
      const emailContent = `${subject} ${body} ${from}`.toLowerCase();
      let category = 'event';
      let priority = 'high';
      let summary = `Calendar event created for: ${subject}`;
      let actionItems = ['Calendar event has been created', 'Check your calendar for details'];

      // Check if it's a job newsletter or similar (shouldn't have gotten a calendar event)
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
        category = 'newsletter';
        priority = 'low';
        summary = `Job newsletter from ${from}`;
        actionItems = ['Review job opportunities', 'Apply to relevant positions'];
        // eslint-disable-next-line no-console
        console.log(
          '⚠️ WARNING: Calendar event was created for a job newsletter - this should not happen!',
        );
      }

      raw = JSON.stringify({
        isWebDevRelated: true,
        category,
        priority,
        summary,
        actionItems,
        sentiment: 'neutral',
        draftResponse: null,
        calendarEvents: [], // Add calendar events to contextual analysis
      });
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
        console.log('📧 Email subject:', subject);
        // eslint-disable-next-line no-console
        console.log('📧 Email from:', from);
      } else {
        for (const call of toolsCalled) {
          // eslint-disable-next-line no-console
          console.log('🔍 Individual tool call:', JSON.stringify(call, null, 2));
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
              //!==============================================================
              //^==============================================================
              // eslint-disable-next-line no-console
              console.log('🗓️ Creating calendar event with args:', args);
              // const eventResult = await createCalendarEvent(userId, args, subject, from);

              // Capture calendar event data if creation was successful
              if (eventResult && eventResult.htmlLink) {
                calendarEvents.push({
                  title: eventResult.summary || args.title,
                  link: eventResult.htmlLink,
                  startTime: eventResult.start?.dateTime || args.startDateTime,
                  endTime: eventResult.end?.dateTime || args.endDateTime,
                  location: eventResult.location || args.location,
                });
                // eslint-disable-next-line no-console
                console.log('✅ Calendar event captured:', eventResult.htmlLink);
              }
            } else {
              // eslint-disable-next-line no-console
              console.log('⚠️ Unknown tool call structure or function name');
            }
          } catch (error) {
            console.error('❌ Error invoking tool call:', error);
          }
        }
      }
    }

    try {
      // Try to parse the raw response as JSON directly first
      const parsed = JSON.parse(raw);

      // Add calendar events to the parsed analysis
      if (calendarEvents.length > 0) {
        parsed.calendarEvents = calendarEvents;
      }

      return parsed;
    } catch {
      try {
        // If that fails, try to extract JSON from the response
        const jsonMatch = raw.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Ignore nested catch
      }

      try {
        // Handle the case where LLM returns function call format with embedded JSON
        const functionCallMatch = raw.match(/"required_json":\s*"([^"]+)"/);
        if (functionCallMatch) {
          const escapedJson = functionCallMatch[1];
          const unescapedJson = escapedJson.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          // eslint-disable-next-line no-console
          console.log('🔧 Extracted JSON from function call:', unescapedJson);
          return JSON.parse(unescapedJson);
        }
      } catch (parseError) {
        console.error('🔧 Failed to parse embedded JSON:', parseError);
      }

      // If all JSON parsing fails, return fallback
      // eslint-disable-next-line no-console
      console.warn('🔧 Falling back to default analysis structure');
      const fallback = {
        summary: raw.slice(0, 150),
        actionItems: [],
        sentiment: 'neutral',
        isWebDevRelated: false,
        category: 'other',
        priority: 'low',
        draftResponse: null,
      };

      // Add calendar events to fallback if any were created
      if (calendarEvents.length > 0) {
        fallback.calendarEvents = calendarEvents;
      }

      return fallback;
    }
  } catch (err) {
    console.error('LLM analysis error:', err);
    return { summary: 'Analysis failed', actionItems: [], sentiment: 'neutral' };
  }
}
