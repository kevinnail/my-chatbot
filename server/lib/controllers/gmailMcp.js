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
    const systemPrompt = `You are an intelligent email agent that helps with job search activities. 
    You analyze emails and provide actionable insights. Your responses should be structured JSON with this format:
    {
      "isJobRelated": true/false,
      "category": "job_application|job_rejection|job_acceptance|job_interview|job_offer|other",
      "priority": "high|medium|low",
      "summary": "Brief summary of the email content",
      "actionItems": ["action1", "action2"],
      "sentiment": "positive|negative|neutral",
      "draftResponse": "Suggested response if appropriate, or null"
    }

    Focus on detecting:
    - Job applications confirmations
    - Interview invitations
    - Rejection letters
    - Job offers
    - Follow-up opportunities
    - Networking opportunities
    - Application status updates

    Be concise but actionable.`;

    const userPrompt = `Analyze this email:

Subject: ${subject}
From: ${from}
Content: ${body}

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
      isJobRelated: checkJobKeywords(subject, body, from),
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
      isJobRelated: checkJobKeywords(subject, body, from),
      category: 'other',
      priority: 'low',
      summary: 'Analysis failed - please review manually',
      actionItems: [],
      sentiment: 'neutral',
      draftResponse: null,
    };
  }
}

// Fallback job keyword detection
function checkJobKeywords(subject, body, from) {
  const jobKeywords = [
    'interview',
    'application',
    'position',
    'job',
    'job match',
    'job matches',
    'career',
    'hiring',
    'recruiter',
    'opportunity',
    'candidate',
    'resume',
    'cv',
    'thank you for applying',
    'unfortunately',
    'we have decided',
    'next steps',
    'congratulations',
    'offer',
    'onboarding',
    'start date',
    'salary',
    'benefits',
    'rejection',
    'not selected',
    'moved forward',
    'different direction',
    'keep your resume',
    'hr',
    'human resources',
    'talent acquisition',
    'screening',
    'phone screen',
    'developer',
    'engineer',
    'software engineer',
    'full stack web developer',
    'full stack mobile developer',
    'full stack developer',
    'full stack engineer',
    'full stack web engineer',
    'full stack mobile engineer',
    'full stack engineer',
    'front end engineer',
    'back end engineer',
    'mobile engineer',
    'web developer',
    'mobile developer',
    'developer',
    'engineer',
    'software engineer',
  ];

  const text = `${subject} ${body} ${from}`.toLowerCase();
  return jobKeywords.some((keyword) => text.includes(keyword));
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

    // Get last sync time
    const lastSync = await getLastSyncTime(userId);

    // Build search criteria - let LLM do the intelligent filtering
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const searchDate = lastSync ? new Date(lastSync) : thirtyDaysAgo;

    // Simplified IMAP search criteria - let LLM analyze all unread emails
    const searchCriteria = [
      'UNSEEN', // Unread emails
      ['SINCE', searchDate], // Since last sync or 30 days ago
      // That's it! Let the LLM do all the intelligent filtering
    ];

    console.log('IMAP search criteria (simplified for better LLM analysis):', searchCriteria);

    // Get emails via IMAP
    const rawEmails = await getEmailsViaImap(searchCriteria);
    const emails = [];

    // Process each email with agentic analysis
    for (const email of rawEmails) {
      try {
        // Perform agentic analysis
        const analysis = await analyzeEmailWithLLM(email.subject, email.body, email.from);

        // Only include job-related emails or high-priority emails
        if (analysis.isJobRelated || analysis.priority === 'high') {
          // Create Gmail web link (best effort)
          const webLink = `https://mail.google.com/mail/u/0/#inbox`;

          emails.push({
            id: email.id,
            subject: email.subject,
            from: email.from,
            date: email.date,
            analysis,
            webLink,
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
