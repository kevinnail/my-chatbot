import { google } from 'googleapis';
import GoogleCalendar from '../models/GoogleCalendar.js';

// Helper function to create calendar event
async function createCalendarEvent(userId, eventArgs, emailSubject, emailBody, emailFrom) {
  try {
    const hasValidTokens = await GoogleCalendar.hasValidTokens(userId);
    if (!hasValidTokens) {
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
    console.log(`✅ Event created: ${res.data.htmlLink}`);
    return res.data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    if (error.response) console.error('API details:', error.response.data);
    throw error;
  }
}

// Email analysis with Ollama
export async function analyzeEmailWithLLM(subject, body, from, userId = null) {
  const currentYear = new Date().getFullYear();
  const systemPrompt = `You are an intelligent email agent that helps users manage their emails both professional and personal. 

  CRITICAL PRIORITY: STRICT APPOINTMENT DETECTION
  You have access to a create_calendar_event tool. You MUST use this tool ONLY when ALL THREE conditions are met:
  
  1. APPOINTMENT KEYWORDS: The email contains explicit appointment/meeting keywords
  2. SPECIFIC DATE/TIME: The email contains specific date and time information (not just years in signatures/copyrights)
  3. SCHEDULING CONTEXT: The email is clearly about scheduling, confirming, or reminding about an actual appointment
  
  REQUIRED APPOINTMENT KEYWORDS (must contain at least one):
  - "appointment", "appt"
  - "meeting at [time]", "call at [time]", "scheduled for [time]"
  - "reschedule", "confirm your appointment", "confirmation"
  - "interview scheduled", "interview at", "interview on"
  - "doctor", "dentist", "medical appointment"
  - "consultation", "follow-up appointment"
  - "phone call scheduled", "video call at", "zoom meeting at"
  - "meet at [location/time]", "coffee at [time]", "lunch at [time]"

  STRICT EXCLUSIONS - NEVER create calendar events for:
  - Job newsletters, job listings, job matches (Built In, LinkedIn, Indeed, etc.)
  - Job application confirmations without specific interview scheduling
  - Marketing emails, promotional content, newsletters
  - Email lists, subscription content, unsubscribe emails
  - Company updates, announcements, or general communications
  - Emails that only contain copyright years or signature dates
  - Course announcements without specific class times
  - General reminders without specific appointment details

  CRITICAL DATE PARSING RULES:
  - IGNORE copyright years, signature years, or footer dates (like "© Built In, 2025")
  - ONLY parse dates that are clearly related to scheduling context
  - Dates must be accompanied by appointment keywords to be valid
  - If you find a year in a copyright/signature, DO NOT use it for calendar events
  - Only extract dates that are explicitly mentioned as appointment times

  EXAMPLE OF WHAT NOT TO DO:
  Email: "New Software Engineer Job Matches... © Built In, 2025"
  - DO NOT extract "2025" as an appointment date
  - DO NOT create calendar events for job newsletters
  - This lacks appointment keywords and scheduling context

  EXAMPLE OF CORRECT USAGE:
  Email: "Confirming your doctor appointment on July 16th at 2pm"
  - Contains "appointment" keyword ✓
  - Contains specific date/time ✓  
  - Has scheduling context ✓
  - Extract: 2024-07-16T14:00:00 (using current year if not specified)

  CRITICAL RESPONSE FORMAT REQUIREMENTS:
  
  You MUST ALWAYS return a complete JSON analysis in your content, even when making tool calls. Never return empty content.

  1. REQUIRED JSON response format (must be valid JSON in your content):
  {
    "isWebDevRelated": true/false,
    "category": "job_application|job_rejection|job_acceptance|job_interview|job_offer|event|learning|tools|networking|newsletter|community|freelance|other",
    "priority": "high|medium|low",
    "summary": "Brief summary of the email content",
    "actionItems": ["action1", "action2"],
    "sentiment": "positive|negative|neutral",
    "draftResponse": "Suggested response if appropriate, or null"
  }

  2. If you detect appointment-related content, you MUST also use the create_calendar_event tool.

  IMPORTANT EXAMPLES:
  - For job newsletters (Built In, LinkedIn, Indeed): Return JSON analysis with category "newsletter", do NOT create calendar events
  - For actual appointments with specific times: Return JSON analysis AND use calendar tool
  - NEVER put tool call parameters in your content response
  - ALWAYS return complete, valid JSON in your content field

  Focus on detecting web development related emails including:
  
  JOB RELATED:
  - Job applications confirmations
  - Interview invitations and scheduling
  - Rejection letters
  - Job offers and negotiations
  - Application status updates
  - Recruiter outreach
  - Job board notifications (Built In, LinkedIn, Indeed, Stack Overflow Jobs, etc.)
  - Contract/freelance opportunities
  
  EVENT RELATED:
  - Tech conferences and meetups
  - Webinars and workshops
  - Hackathons and coding challenges
  - Industry events and networking
  - Training sessions and boot camps
  - Company tech talks
  
  APPOINTMENTS & MEETINGS:
  - Doctor appointments and medical visits
  - Dentist appointments
  - Phone calls and video calls
  - Business meetings and client calls
  - Personal meetings and catch-ups
  - Service appointments (car, home, etc.)
  - Consultation appointments
  - Follow-up meetings
  - One-on-one meetings
  - Team meetings and standups
  - Coffee meetings and informal chats
  
  LEARNING RELATED:
  - Course platforms (Udemy, Coursera, Pluralsight, etc.)
  - Tutorial sites and coding platforms
  - Certification programs
  - Technical book releases
  - Educational content updates
  
  TOOLS & TECHNOLOGY:
  - Platform updates (AWS, Google Cloud, Azure, etc.)
  - Framework releases (React, Angular, Vue, etc.)
  - Development tool updates
  - API documentation and changes
  - Software licenses and subscriptions
  - IDE and editor updates
  
  COMMUNITY & NETWORKING:
  - Developer community updates
  - Open source project notifications
  - GitHub activity and contributions
  - Technical forum discussions
  - Developer newsletter subscriptions
  - Coding community events
  
  OTHER PROFESSIONAL:
  - Client communications
  - Project updates and deadlines
  - Team collaboration emails
  - Code review notifications
  - Professional development opportunities

  Be comprehensive but accurate in your categorization.`;

  // Define the calendar event creation tool

  const userPrompt = `Analyze this email:\nSubject: ${subject}\nBody: ${body}\nFrom: ${from}`;

  const tools = [
    {
      type: 'function',
      function: {
        name: 'create_calendar_event',
        description:
          'Create a calendar event for appointments, meetings, interviews, or other scheduled events',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The title/summary of the event',
            },
            description: {
              type: 'string',
              description: 'Detailed description of the event',
            },
            startDateTime: {
              type: 'string',
              description: 'Start date and time in ISO format (e.g., 2024-01-15T10:00:00)',
            },
            endDateTime: {
              type: 'string',
              description: 'End date and time in ISO format (e.g., 2024-01-15T11:00:00)',
            },
            location: {
              type: 'string',
              description: 'Location of the event (optional)',
            },
            attendees: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of attendee email addresses',
            },
          },
          required: ['title', 'startDateTime', 'endDateTime'],
        },
      },
    },
  ];

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

    const LLMStartTime = performance.now();

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
    console.log('🔍 Raw Ollama response:', JSON.stringify(data, null, 2));
    const LLMEndTime = performance.now();
    console.log(
      `FINISH LLM CALL total time spent: ${(LLMEndTime - LLMStartTime).toFixed(1) / 1000 / 60} minutes`,
    );

    let raw =
      data.message && typeof data.message.content === 'string'
        ? data.message.content.trim()
        : JSON.stringify(data);
    const toolsCalled = data.message?.tool_calls || [];

    console.log('🔍 Extracted content:', raw);
    console.log('🔍 Tool calls found:', toolsCalled);
    console.log('userId', userId);

    // If we have tool calls but empty content, generate a contextual analysis
    if (toolsCalled.length > 0 && (!raw || raw === '')) {
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
        console.log('🚫 BLOCKED: Preventing calendar event creation for job newsletter');
        console.log('📧 Email subject:', subject);
        console.log('📧 Email from:', from);
      } else {
        for (const call of toolsCalled) {
          console.log('🔍 Individual tool call:', JSON.stringify(call, null, 2));
          try {
            if (call.function && call.function.name === 'create_calendar_event') {
              console.log('🗓️ Creating calendar event with args:', call.function.arguments);
              await createCalendarEvent(userId, call.function.arguments, subject, body, from);
            } else {
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
          console.log('🔧 Extracted JSON from function call:', unescapedJson);
          return JSON.parse(unescapedJson);
        }
      } catch (parseError) {
        console.error('🔧 Failed to parse embedded JSON:', parseError);
      }

      // If all JSON parsing fails, return fallback
      console.warn('🔧 Falling back to default analysis structure');
      return {
        summary: raw.slice(0, 150),
        actionItems: [],
        sentiment: 'neutral',
        isWebDevRelated: false,
        category: 'other',
        priority: 'low',
        draftResponse: null,
      };
    }
  } catch (err) {
    console.error('LLM analysis error:', err);
    return { summary: 'Analysis failed', actionItems: [], sentiment: 'neutral' };
  }
}

export function checkWebDevKeywords(subject, body, from) {
  const keywords = [
    /* list trimmed */
  ];
  const text = `${subject} ${body} ${from}`.toLowerCase();
  return keywords.some((k) => text.includes(k));
}
