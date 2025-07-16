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

  CRITICAL PRIORITY: APPOINTMENT DETECTION
  You have access to a create_calendar_event tool. You MUST use this tool ONLY when you detect ACTUAL appointment-related emails with SPECIFIC dates and times, including:
  - Meeting invitations or confirmations WITH specific date/time
  - Interview scheduling WITH specific date/time
  - Appointment reminders WITH specific date/time (including "appt" abbreviation)
  - Calendar invitations WITH specific date/time
  - Doctor, dentist, medical appointments WITH specific date/time
  - Service appointments WITH specific date/time (car, home, etc.)
  - Personal meetings and calls WITH specific date/time
  - Business meetings WITH specific date/time
  - Consultation appointments WITH specific date/time

  DO NOT create calendar events for:
  - Job newsletters or job listings (Built In, LinkedIn, Indeed, etc.)
  - Job application confirmations without interview times
  - General job-related emails without specific meeting times
  - Course announcements or newsletters
  - Marketing emails or promotional content
  - General reminders without specific dates
  - Email lists or subscription content
  - Job search notifications
  - Company updates or news

  Only look for these SPECIFIC appointment indicators: "appointment", "appt", "meeting at", "call at", "scheduled for", "reschedule", "confirm", "confirmation", "reminder", "calendar", "invite", "invitation", "doctor", "dentist", "medical", "clinic", "hospital", "consultation", "follow-up", "follow up", "catch up", "phone call", "video call", "zoom meeting", "teams meeting", "meet at", "coffee at", "lunch at", "dinner at", "one-on-one", "standup", "sync", "check-in", "service", "maintenance"

  IMPORTANT: The email must contain BOTH appointment keywords AND specific date/time information to warrant a calendar event.

  When parsing dates, be flexible with formats like:
  - "weds july 16th at 2pm" -> If year not specified, assume current year ${currentYear} (e.g., ${currentYear}-07-16T14:00:00)
  - "tomorrow at 3pm" -> calculate the actual date based on today's date
  - "next friday 10am" -> calculate the actual date based on today's date
  - Always convert to ISO format (YYYY-MM-DDTHH:mm:ss)
  - For duration, assume 1 hour if not specified (e.g., end time = start time + 1 hour)
  - If a date seems to be in the past and no year is specified, assume it's for the following year (${currentYear + 1})
  
  IMPORTANT DATE LOGIC:
  - Current year is ${currentYear}
  - If no year is specified and the date seems recent or upcoming, use ${currentYear}
  - If no year is specified and the date appears to be in the past, use ${currentYear + 1}
  - Always double-check that your parsed dates make logical sense
  
  EXAMPLE: If you see "Just wanted to confirm your appt on weds july 16th at 2pm", you should:
  1. Recognize "appt" as appointment
  2. Parse "weds july 16th at 2pm" as ${currentYear}-07-16T14:00:00 (assuming current year)
  3. Set end time as ${currentYear}-07-16T15:00:00 (1 hour duration)
  4. Use the create_calendar_event tool with these parameters

  You MUST always return both:
  1. A structured JSON response with this format:
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

  IMPORTANT: You must return the JSON analysis in your response content even when making tool calls. Do not return empty content.

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

      // Check if it's a job newsletter (shouldn't have gotten a calendar event)
      if (
        emailContent.includes('job matches') ||
        emailContent.includes('builtin') ||
        emailContent.includes('linkedin') ||
        emailContent.includes('indeed') ||
        emailContent.includes('newsletter') ||
        emailContent.includes('unsubscribe')
      ) {
        category = 'newsletter';
        priority = 'low';
        summary = `Job newsletter from ${from}`;
        actionItems = ['Review job opportunities', 'Apply to relevant positions'];
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
    // Invoke calendar tool
    if (userId && toolsCalled.length) {
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

    try {
      // Try to parse the raw response as JSON directly first
      const parsed = JSON.parse(raw);
      return parsed;
    } catch {
      try {
        // If that fails, try to extract JSON from the response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Ignore nested catch
      }
      // If all JSON parsing fails, return fallback
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
