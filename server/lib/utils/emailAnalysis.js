import { google } from 'googleapis';
import GoogleCalendar from '../models/GoogleCalendar.js';

// Helper function to create calendar event
async function createCalendarEvent(userId, eventArgs, emailSubject, emailBody, emailFrom) {
  try {
    // Check if user has valid Google Calendar tokens
    const hasValidTokens = await GoogleCalendar.hasValidTokens(userId);
    if (!hasValidTokens) {
      console.log('User does not have valid Google Calendar tokens, skipping event creation');
      return;
    }

    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    const tokens = await GoogleCalendar.getTokens(userId);
    oauth2Client.setCredentials(tokens);

    // Create calendar API client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Check for existing events at the same time (conflict detection)
    const startTime = new Date(eventArgs.startDateTime);
    const endTime = new Date(eventArgs.endDateTime);

    try {
      const existingEvents = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      if (existingEvents.data.items && existingEvents.data.items.length > 0) {
        console.log('CONFLICT DETECTED: There are existing events at this time:');
        existingEvents.data.items.forEach((event, index) => {
          console.log(
            `   ${index + 1}. "${event.summary}" from ${event.start.dateTime || event.start.date} to ${event.end.dateTime || event.end.date}`,
          );
        });

        // Still create the event but with a note about the conflict
        const conflictNote = `\n\nCONFLICT WARNING: There ${existingEvents.data.items.length === 1 ? 'is' : 'are'} ${existingEvents.data.items.length} existing event${existingEvents.data.items.length === 1 ? '' : 's'} at this time:\n${existingEvents.data.items.map((e) => `• ${e.summary}`).join('\n')}`;
        eventArgs.description = (eventArgs.description || '') + conflictNote;
      }
    } catch (conflictError) {
      console.error('Error checking for conflicts:', conflictError);
    }

    // Format the event for Google Calendar
    const event = {
      summary: eventArgs.title,
      description:
        eventArgs.description ||
        `Created from email: ${emailSubject}\n\nOriginal email from: ${emailFrom}`,
      location: eventArgs.location,
      start: {
        dateTime: eventArgs.startDateTime,
        timeZone: 'America/Los_Angeles',
      },
      end: {
        dateTime: eventArgs.endDateTime,
        timeZone: 'America/Los_Angeles',
      },
      attendees: eventArgs.attendees ? eventArgs.attendees.map((email) => ({ email })) : [],
    };

    // Create the event
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    console.log(`✅ Calendar event created successfully: ${response.data.htmlLink}`);
    if (response.data.status === 'confirmed') {
      console.log(`Event "${event.summary}" confirmed for ${eventArgs.startDateTime}`);
    }

    return response.data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    if (error.response) {
      console.error('API Error Details:', error.response.data);
    }
    throw error;
  }
}

// Agentic email analysis using local Ollama
export async function analyzeEmailWithLLM(subject, body, from, userId = null) {
  try {
    const currentYear = new Date().getFullYear();
    const systemPrompt = `You are an intelligent email agent that helps users manage their emails both professional and personal. 

    CRITICAL PRIORITY: APPOINTMENT DETECTION
    You have access to a create_calendar_event tool. You MUST use this tool when you detect ANY appointment-related emails, including:
    - Meeting invitations or confirmations
    - Interview scheduling or reminders
    - Event confirmations or reminders
    - Appointment reminders (including "appt" abbreviation)
    - Calendar invitations
    - Doctor, dentist, medical appointments
    - Service appointments (car, home, etc.)
    - Personal meetings and calls
    - Business meetings
    - Consultation appointments
    - Follow-up meetings
    - One-on-one meetings
    - Coffee meetings, lunch meetings
    - Any scheduled activity with a specific date and time

    Look for these keywords (case-insensitive): "appointment", "appt", "meeting", "call", "schedule", "scheduled", "reschedule", "confirm", "confirmation", "reminder", "calendar", "invite", "invitation", "doctor", "dentist", "medical", "clinic", "hospital", "consultation", "follow-up", "follow up", "catch up", "phone call", "video call", "zoom", "teams", "meet", "coffee", "lunch", "dinner", "one-on-one", "standup", "sync", "check-in", "service", "maintenance"

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

    Your responses should be structured JSON with this format:
    {
      "isWebDevRelated": true/false,
      "category": "job_application|job_rejection|job_acceptance|job_interview|job_offer|event|learning|tools|networking|newsletter|community|freelance|other",
      "priority": "high|medium|low",
      "summary": "Brief summary of the email content",
      "actionItems": ["action1", "action2"],
      "sentiment": "positive|negative|neutral",
      "draftResponse": "Suggested response if appropriate, or null"
    }

    If you detect appointment-related content, you MUST also use the create_calendar_event tool.

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

    const userPrompt = `Analyze this email:
    Subject: ${subject}
    Body: ${body}
    From: ${from}

Provide your analysis in the JSON format specified.`;

    // Define the calendar event creation tool
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

    const response = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: tools,
        options: {
          temperature: 0.3, // Lower temperature for more consistent JSON output
          top_p: 0.9,
        },
        stream: false,
      }),
    });

    const data = await response.json();
    const rawResponse = data.message?.content || '';
    const toolCalls = data.message?.tool_calls || [];

    // Handle tool calls if present
    if (toolCalls.length > 0 && userId) {
      for (const toolCall of toolCalls) {
        if (toolCall.function.name === 'create_calendar_event') {
          try {
            // Ollama returns arguments as objects, not strings
            const args = toolCall.function.arguments;

            await createCalendarEvent(userId, args, subject, body, from);
          } catch (error) {
            console.error('Error creating calendar event:', error);
          }
        }
      }
    } else {
      console.log('❌ No tool calls detected or no userId provided');
      console.log('Tool calls length:', toolCalls.length);
      console.log('User ID:', userId);
    }

    try {
      // Try to parse JSON response
      const analysisMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (analysisMatch) {
        return JSON.parse(analysisMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing LLM JSON response:', parseError);
    }

    // Fallback analysis if JSON parsing fails
    const fallbackAnalysis = {
      isWebDevRelated: checkWebDevKeywords(subject, body, from),
      category: 'other',
      priority: 'medium',
      summary: rawResponse.slice(0, 150) + '...',
      actionItems: [],
      sentiment: 'neutral',
      draftResponse: null,
    };

    return fallbackAnalysis;
  } catch (error) {
    console.error('Error analyzing email with LLM:', error);
    return {
      isWebDevRelated: checkWebDevKeywords(subject, body, from),
      category: 'other',
      priority: 'low',
      summary: 'Analysis failed - please review manually',
      actionItems: [],
      sentiment: 'neutral',
      draftResponse: null,
    };
  }
}

// Fallback web development keyword detection
export function checkWebDevKeywords(subject, body, from) {
  const webDevKeywords = [
    // Job related terms
    'job',
    'interview',
    'application',
    'position',
    'career',
    'hiring',
    'recruiter',
    'opportunity',
    'candidate',
    'resume',
    'cv',
    'offer',
    'salary',
    'benefits',
    'rejection',
    'not selected',
    'moved forward',

    // Developer roles
    'developer',
    'engineer',
    'software engineer',
    'web developer',
    'frontend developer',
    'backend developer',
    'full stack developer',
    'full stack engineer',
    'fullstack',
    'mobile developer',
    'react developer',
    'javascript developer',
    'node.js developer',
    'python developer',
    'java developer',
    'php developer',
    'devops engineer',
    'ui developer',
    'ux developer',
    'front end',
    'back end',
    'frontend',
    'backend',

    // Technologies and frameworks
    'react',
    'angular',
    'vue',
    'javascript',
    'typescript',
    'node.js',
    'python',
    'java',
    'php',
    'ruby',
    'html',
    'css',
    'sass',
    'scss',
    'bootstrap',
    'tailwind',
    'mongodb',
    'mysql',
    'postgresql',
    'redis',
    'aws',
    'azure',
    'google cloud',
    'docker',
    'kubernetes',
    'git',
    'github',
    'gitlab',
    'bitbucket',

    // Company types and job boards
    'built in',
    'linkedin',
    'indeed',
    'stack overflow',
    'github jobs',
    'angel list',
    'glassdoor',
    'dice',
    'monster',
    'ziprecruiter',
    'flexa',
    'startup',
    'tech company',

    // Event related
    'conference',
    'meetup',
    'webinar',
    'workshop',
    'hackathon',
    'coding challenge',
    'tech talk',
    'training',
    'bootcamp',
    'event',
    'networking',

    // Appointments and meetings
    'appointment',
    'appt',
    'meeting',
    'call',
    'schedule',
    'scheduled',
    'reschedule',
    'confirm',
    'confirmation',
    'reminder',
    'calendar',
    'invite',
    'invitation',
    'doctor',
    'dentist',
    'medical',
    'clinic',
    'hospital',
    'consultation',
    'follow-up',
    'follow up',
    'catch up',
    'phone call',
    'video call',
    'zoom',
    'teams',
    'meet',
    'coffee',
    'lunch',
    'dinner',
    'one-on-one',
    'standup',
    'sync',
    'check-in',
    'service',
    'maintenance',

    // Learning platforms
    'udemy',
    'coursera',
    'pluralsight',
    'codecademy',
    'freecodecamp',
    'lynda',
    'edx',
    'khan academy',
    'treehouse',
    'skillshare',
    'tutorial',
    'course',

    // Tools and platforms
    'visual studio code',
    'vscode',
    'sublime text',
    'atom',
    'intellij',
    'webstorm',
    'figma',
    'sketch',
    'adobe xd',
    'postman',
    'insomnia',
    'slack',
    'discord',
    'jira',
    'trello',
    'asana',
    'notion',
    'confluence',

    // Community and newsletters
    'hacker news',
    'dev.to',
    'medium',
    'newsletter',
    'weekly',
    'digest',
    'open source',
    'github',
    'contribution',
    'pull request',
    'code review',

    // Professional development
    'certification',
    'learning path',
    'skill development',
    'career growth',
    'professional development',
    'tech trends',
    'industry update',
  ];

  const text = `${subject} ${body} ${from}`.toLowerCase();
  return webDevKeywords.some((keyword) => text.includes(keyword));
}
