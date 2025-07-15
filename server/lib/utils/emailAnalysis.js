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

    // Format the event for Google Calendar
    const event = {
      summary: eventArgs.title,
      description:
        eventArgs.description ||
        `Created from email: ${emailSubject}\n\nOriginal email from: ${emailFrom}`,
      location: eventArgs.location,
      start: {
        dateTime: eventArgs.startDateTime,
        timeZone: 'America/New_York', // Default timezone
      },
      end: {
        dateTime: eventArgs.endDateTime,
        timeZone: 'America/New_York', // Default timezone
      },
      attendees: eventArgs.attendees ? eventArgs.attendees.map((email) => ({ email })) : [],
    };

    // Create the event
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    console.log(`Calendar event created: ${response.data.htmlLink}`);
  } catch (error) {
    console.error('Error creating calendar event:', error);
  }
}

// Agentic email analysis using local Ollama
export async function analyzeEmailWithLLM(subject, body, from, userId = null) {
  try {
    const systemPrompt = `You are an intelligent email agent that helps web developers manage their professional emails. 
    You analyze emails and provide actionable insights. Your responses should be structured JSON with this format:
    {
      "isWebDevRelated": true/false,
      "category": "job_application|job_rejection|job_acceptance|job_interview|job_offer|event|learning|tools|networking|newsletter|community|freelance|other",
      "priority": "high|medium|low",
      "summary": "Brief summary of the email content",
      "actionItems": ["action1", "action2"],
      "sentiment": "positive|negative|neutral",
      "draftResponse": "Suggested response if appropriate, or null"
    }

    You also have access to a create_calendar_event tool. Use this tool ONLY when you detect appointment-related emails such as:
    - Meeting invitations
    - Interview scheduling
    - Event confirmations
    - Appointment reminders
    - Calendar invitations
    - One on one calls
    
    When you detect such emails, extract the relevant information and create a calendar event.

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
            const args = JSON.parse(toolCall.function.arguments);
            await createCalendarEvent(userId, args, subject, body, from);
            console.log('📅 Calendar event created from email analysis');
          } catch (error) {
            console.error('Error creating calendar event:', error);
          }
        }
      }
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
