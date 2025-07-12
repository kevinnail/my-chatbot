import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { pool } from '../utils/db.js';

// IMAP connection configuration
const getImapConfig = () => ({
  user: process.env.GMAIL_USER,
  password: process.env.GMAIL_APP_PASSWORD,
  host: process.env.GMAIL_IMAP_HOST || 'imap.gmail.com',
  port: process.env.GMAIL_IMAP_PORT || 993,
  tls: true,
  tlsOptions: {
    servername: 'imap.gmail.com',
  },
});

// Test IMAP connection
const testImapConnection = () => {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());

    imap.once('ready', () => {
      imap.end();
      resolve(true);
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
};

// Get Gmail connection status
export const getGmailStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if IMAP credentials are configured
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res.json({ connected: false, error: 'IMAP credentials not configured' });
    }

    // Test IMAP connection
    try {
      await testImapConnection();
    } catch (err) {
      return res.json({ connected: false, error: 'IMAP connection failed' });
    }

    // Get last sync time
    let lastSync = null;
    const syncResult = await pool.query(
      'SELECT last_sync FROM gmail_sync_status WHERE user_id = $1',
      [userId],
    );
    lastSync = syncResult.rows[0]?.last_sync;

    res.json({ connected: true, lastSync });
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    res.status(500).json({ error: 'Failed to check Gmail status' });
  }
};

// Connect to Gmail (now just tests connection)
export const connectGmail = async (req, res) => {
  try {
    const { userId } = req.body;

    // Test IMAP connection
    await testImapConnection();

    // Initialize sync status
    await pool.query(
      `INSERT INTO gmail_sync_status (user_id, last_sync) 
       VALUES ($1, NOW()) 
       ON CONFLICT (user_id) DO UPDATE SET last_sync = NOW()`,
      [userId],
    );

    res.json({ success: true, message: 'Gmail IMAP connection successful' });
  } catch (error) {
    console.error('Error connecting to Gmail:', error);
    res.status(500).json({ error: 'Failed to connect to Gmail via IMAP' });
  }
};

// IMAP connection is direct - no callback needed
export const handleGmailCallback = async (req, res) => {
  res.redirect(`${process.env.CLIENT_URL}/gmail-mcp?connected=true`);
};

// Agentic email analysis using local Ollama
async function analyzeEmailWithLLM(subject, body, from) {
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

    const response = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: {
          temperature: 0.3, // Lower temperature for more consistent JSON output
          top_p: 0.9,
        },
        stream: false,
      }),
    });

    const data = await response.json();
    const rawResponse = data.message?.content || '';

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
function checkWebDevKeywords(subject, body, from) {
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

// Get last sync time
async function getLastSyncTime(userId) {
  const result = await pool.query('SELECT last_sync FROM gmail_sync_status WHERE user_id = $1', [
    userId,
  ]);

  return result.rows[0]?.last_sync;
}

// Update last sync time
async function updateLastSyncTime(userId) {
  await pool.query(
    `INSERT INTO gmail_sync_status (user_id, last_sync) 
     VALUES ($1, NOW()) 
     ON CONFLICT (user_id) DO UPDATE SET last_sync = NOW()`,
    [userId],
  );
}

// Parse email body from IMAP data
function parseEmailBody(body) {
  // Remove HTML tags and clean up the text
  let cleanText = body
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
    .trim();

  // Limit body length
  if (cleanText.length > 2000) {
    cleanText = cleanText.substring(0, 2000) + '...';
  }

  return cleanText;
}

// Get emails using IMAP
function getEmailsViaImap(searchCriteria) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());
    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        // Search for emails based on criteria
        imap.search(searchCriteria, (err, results) => {
          if (err) {
            reject(err);
            return;
          }

          if (!results || results.length === 0) {
            imap.end();
            resolve([]);
            return;
          }

          // Limit results to prevent overwhelming
          const limitedResults = results.slice(0, 50);

          const fetch = imap.fetch(limitedResults, { bodies: '', markSeen: false });

          fetch.on('message', (msg, seqno) => {
            let body = '';
            let attributes = null;

            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });

              stream.once('end', () => {
                body = buffer;
              });
            });

            msg.once('attributes', (attrs) => {
              attributes = attrs;
            });

            msg.once('end', () => {
              // Parse the email
              simpleParser(body, (err, parsed) => {
                if (err) {
                  console.error('Error parsing email:', err);
                  return;
                }

                emails.push({
                  id: attributes.uid,
                  subject: parsed.subject || 'No Subject',
                  from: parsed.from?.text || 'Unknown Sender',
                  date: parsed.date || new Date(),
                  body: parseEmailBody(parsed.text || parsed.html || ''),
                  attributes: attributes,
                });
              });
            });
          });

          fetch.once('error', (err) => {
            reject(err);
          });

          fetch.once('end', () => {
            imap.end();
            resolve(emails);
          });
        });
      });
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
}

// Agentic email sync with intelligent filtering
export const syncEmails = async (req, res) => {
  try {
    const { userId } = req.body;

    // Get last sync time for tracking purposes
    const lastSync = await getLastSyncTime(userId);

    // Build search criteria - analyze ALL unread emails every time
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Always look at ALL unread emails from last 30 days, not just since last sync
    const searchCriteria = [
      'UNSEEN', // All unread emails
      ['SINCE', thirtyDaysAgo], // From last 30 days (ignore last sync time)
      // Let the LLM analyze all of them fresh each time
    ];

    console.log(
      'IMAP search criteria (analyzing ALL unread emails for web dev content):',
      searchCriteria,
    );

    // Get emails via IMAP
    const rawEmails = await getEmailsViaImap(searchCriteria);
    const emails = [];

    // Process each email with agentic analysis
    for (const email of rawEmails) {
      try {
        // Perform agentic analysis
        const analysis = await analyzeEmailWithLLM(email.subject, email.body, email.from);

        // Only include web development related emails
        if (analysis.isWebDevRelated) {
          // Check if email is new since last sync
          const isNewSinceLastSync = lastSync ? new Date(email.date) > new Date(lastSync) : true;

          // Create Gmail web link (best effort)
          const webLink = `https://mail.google.com/mail/u/0/#inbox`;

          emails.push({
            id: email.id,
            subject: email.subject,
            from: email.from,
            date: email.date,
            analysis,
            webLink,
            isNewSinceLastSync,
            // Keep original fields for backward compatibility
            summary: analysis.summary,
          });
        }
      } catch (error) {
        console.error('Error processing email:', error);
      }
    }

    // Update last sync time
    await updateLastSyncTime(userId);

    res.json({ emails });
  } catch (error) {
    console.error('Error syncing emails:', error);
    res.status(500).json({ error: 'Failed to sync emails via IMAP' });
  }
};
