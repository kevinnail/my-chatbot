import { Router } from 'express';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { pool } from '../utils/db.js';
import { getEmbedding } from '../utils/ollamaEmbed.js';
import EmailMemory from '../models/EmailMemory.js';

const router = Router();

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
router.get('/status/:userId', async (req, res) => {
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
});

// Connect to Gmail (now just tests connection)
router.post('/connect', async (req, res) => {
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
});

// IMAP connection is direct - no callback needed
router.get('/callback', async (req, res) => {
  res.redirect(`${process.env.CLIENT_URL}/gmail-mcp?connected=true`);
});

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
                  attributes,
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

// Vector pre-filtering for web development emails
async function preFilterWebDevEmails(emails) {
  try {
    console.log('🔍 Pre-filtering emails using vector similarity...');

    // Create a reference embedding for "web development emails"
    const webDevReference = `
      web development job application matches interview position software engineer developer     
       rejection not selected moved forward resume react javascript node.js express typescript      
       frontend backend full stack developer career coding programming technical interview
      job offer recruitment startup tech company software development career opportunity
      AI community meetup zoom machine learning AI agent AI assistant AI chatbot AI chat HTML5 CSS3       
      SCSS Sass LESS responsive design flexbox grid layout Webpack Babel ESLint Prettier
      Bootstrap Tailwind CSS Material UI Ant Design Chakra UI Figma Sketch Adobe XD UX/UI
      accessibility SEO performance optimization REST API GraphQL microservices serverless
      Docker Kubernetes AWS Azure Google Cloud Platform GCP CI/CD Git GitHub GitLab
      version control unit testing integration testing end-to-end testing Jest Mocha
      Cypress Selenium project manager hiring manager recruiter HR salary compensation
      benefits equity relocation visa sponsorship remote on-site hybrid
      internship contract freelance full-time part-time coding test take-home assignment
      whiteboard interview pair programming technical screening code challenge algorithm
      design data structures system design code review pull request merge request backlog
      grooming sprint planning agile scrum kanban stand-up retrospective team collaboration
      soft skills communication skills problem solving career growth leadership mentorship
      deep learning neural network data science ML engineer data engineer AI engineer NLP
      natural language processing computer vision transformer GPT BERT LLM embeddings
      RAG vector database
    `;

    const referenceEmbedding = await getEmbedding(webDevReference);

    // Calculate similarity for each email
    const emailsWithSimilarity = await Promise.all(
      emails.map(async (email) => {
        const emailContent = `${email.subject} ${email.body} ${email.from}`;
        const emailEmbedding = await getEmbedding(emailContent);

        // Calculate cosine similarity
        const similarity = calculateCosineSimilarity(referenceEmbedding, emailEmbedding);

        console.log(
          `📧 Email: "${email.subject.substring(0, 50)}..." - Similarity: ${similarity.toFixed(3)}`,
        );

        return {
          ...email,
          similarity,
          likelyWebDev: similarity > 0.52, // Match the analysis threshold
        };
      }),
    );

    // Sort by similarity and return top candidates
    const sortedEmails = emailsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

    // Always include at least the top 3 most similar emails (or fewer if less than 3 total)
    const minEmailsToAnalyze = Math.min(3, emails.length);
    const likelyWebDevEmails = sortedEmails.slice(
      0,
      Math.max(minEmailsToAnalyze, sortedEmails.filter((email) => email.likelyWebDev).length),
    );
    const unlikelyEmails = sortedEmails.slice(likelyWebDevEmails.length);

    console.log(`📊 Vector pre-filtering results:
      - Total emails: ${emails.length}
      - Likely web-dev: ${likelyWebDevEmails.length}
      - Unlikely: ${unlikelyEmails.length}
      - LLM calls reduced by: ${Math.round((unlikelyEmails.length / emails.length) * 100)}%`);

    return {
      likelyWebDevEmails,
      unlikelyEmails,
      totalEmails: emails.length,
      reductionPercentage: Math.round((unlikelyEmails.length / emails.length) * 100),
    };
  } catch (error) {
    console.error('Error in vector pre-filtering:', error);
    // Fallback to keyword filtering if vector fails
    return {
      likelyWebDevEmails: emails.filter((email) =>
        checkWebDevKeywords(email.subject, email.body, email.from),
      ),
      unlikelyEmails: [],
      totalEmails: emails.length,
      reductionPercentage: 0,
    };
  }
}

// Simple cosine similarity calculation
function calculateCosineSimilarity(embedding1, embedding2) {
  // Parse embeddings - they come as strings like "[0.1,0.2,0.3]"
  const vec1 = typeof embedding1 === 'string' ? JSON.parse(embedding1) : embedding1;
  const vec2 = typeof embedding2 === 'string' ? JSON.parse(embedding2) : embedding2;

  // Calculate dot product and norms
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  // Return cosine similarity
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Persistent vector-powered email sync - now with real-time updates
router.post('/sync', async (req, res) => {
  try {
    const { userId } = req.body;

    console.log('🚀 Starting persistent vector-powered email sync...');

    // Get last sync time for tracking purposes
    const lastSync = await getLastSyncTime(userId);

    // Build search criteria - get recent emails
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Search for emails from last 30 days
    const searchCriteria = [
      'UNSEEN', // All unread emails
      ['SINCE', thirtyDaysAgo], // From last 30 days
    ];

    console.log('📧 Fetching emails via IMAP...');

    // Get emails via IMAP
    const rawEmails = await getEmailsViaImap(searchCriteria);
    console.log(`📬 Found ${rawEmails.length} raw emails`);

    // Step 1: Filter out emails already in database and calculate similarity for new ones
    const newEmails = [];
    for (const email of rawEmails) {
      const exists = await EmailMemory.emailExists(userId, email.id);
      if (!exists) {
        newEmails.push(email);
      }
    }

    console.log(
      `✨ Found ${newEmails.length} new emails (${rawEmails.length - newEmails.length} already stored)`,
    );

    let newEmailsStored = 0;
    if (newEmails.length > 0) {
      // Use the preFilterWebDevEmails function to efficiently filter emails
      const filterResults = await preFilterWebDevEmails(newEmails);

      console.log(
        `📊 Pre-filter results: ${filterResults.likelyWebDevEmails.length} likely web-dev emails, ${filterResults.reductionPercentage}% reduction`,
      );

      // Store likely web-dev emails with their similarity scores
      for (const email of filterResults.likelyWebDevEmails) {
        try {
          await EmailMemory.storeEmail({
            userId,
            emailId: email.id,
            subject: email.subject,
            sender: email.from,
            body: email.body,
            emailDate: email.date,
            similarityScore: email.similarity,
            llmAnalysis: null,
          });

          newEmailsStored++;
        } catch (error) {
          console.error('Error storing email:', error);
        }
      }

      // Optionally store unlikely emails with low similarity (for completeness)
      for (const email of filterResults.unlikelyEmails) {
        try {
          await EmailMemory.storeEmail({
            userId,
            emailId: email.id,
            subject: email.subject,
            sender: email.from,
            body: email.body,
            emailDate: email.date,
            similarityScore: email.similarity,
            llmAnalysis: null,
          });

          newEmailsStored++;
        } catch (error) {
          console.error('Error storing email:', error);
        }
      }
    }

    // Step 2: Get preliminary results - include emails that will be analyzed
    const allStoredEmails = await EmailMemory.getWebDevEmails({
      userId,
      limit: 51,
      since: null,
    });

    // Also get emails that meet similarity threshold but haven't been analyzed yet
    const pendingAnalysisEmails = await EmailMemory.getEmailsNeedingAnalysis({
      userId,
      minSimilarity: 0.52,
      limit: 10,
    });

    // Create preliminary results that include both analyzed and pending emails
    const preliminaryEmailsMap = new Map();

    // Add all stored emails
    allStoredEmails.forEach((email) => {
      preliminaryEmailsMap.set(email.email_id, {
        id: email.email_id,
        subject: email.subject,
        from: email.sender,
        date: email.email_date,
        analysis: email.llm_analysis,
        webLink: 'https://mail.google.com/mail/u/0/#inbox',
        isNewSinceLastSync: lastSync ? new Date(email.email_date) > new Date(lastSync) : true,
        summary: email.llm_analysis?.summary || 'Analysis pending...',
        vectorSimilarity: email.similarity_score?.toFixed(3) || '0.000',
        analyzed: email.llm_analyzed,
        category: email.llm_analysis?.category,
        priority: email.llm_analysis?.priority,
        status: email.llm_analyzed ? 'analyzed' : 'pending',
      });
    });

    // Add pending analysis emails (they might not be in webDevEmails yet)
    pendingAnalysisEmails.forEach((email) => {
      if (!preliminaryEmailsMap.has(email.email_id)) {
        preliminaryEmailsMap.set(email.email_id, {
          id: email.email_id,
          subject: email.subject,
          from: email.sender,
          date: email.email_date,
          analysis: null,
          webLink: 'https://mail.google.com/mail/u/0/#inbox',
          isNewSinceLastSync: lastSync ? new Date(email.email_date) > new Date(lastSync) : true,
          summary: 'Analysis pending...',
          vectorSimilarity: email.similarity_score?.toFixed(3) || '0.000',
          analyzed: false,
          category: null,
          priority: null,
          status: 'pending',
        });
      }
    });

    const preliminaryEmails = Array.from(preliminaryEmailsMap.values());

    console.log(`📦 Returning ${preliminaryEmails.length} preliminary emails`);

    // Step 3: Return preliminary results immediately
    res.json({
      emails: preliminaryEmails,
      performance: {
        totalFetched: rawEmails.length,
        newStored: newEmailsStored,
        analyzed: 0, // Analysis happening in background
        llmCallsReduced: 0,
        totalWebDevEmails: preliminaryEmails.length,
        estimatedTimeSaved: '0 minutes',
        method: 'Preliminary Results - Analysis in Progress 🔄',
      },
      status: 'preliminary',
      analysisInProgress: true,
    });

    // Step 4: Start background analysis (don't wait for it)
    setImmediate(async () => {
      try {
        // Analyze all emails shown to user that need analysis
        const emailsNeedingAnalysis = preliminaryEmails.filter((email) => !email.analyzed);

        console.log(
          `🤖 Background analysis starting for ${emailsNeedingAnalysis.length} emails from preliminary results`,
        );

        // Run LLM analysis on emails shown to user that need analysis
        let analyzedCount = 0;
        for (const email of emailsNeedingAnalysis) {
          try {
            console.log(
              `🧠 Analyzing: "${email.subject.substring(0, 50)}..." (similarity: ${email.vectorSimilarity})`,
            );

            // Get full email body from database for analysis
            const fullEmail = await EmailMemory.getEmailById(userId, email.id);
            if (!fullEmail) {
              console.warn(`Email ${email.id} not found in database`);
              continue;
            }

            const analysis = await analyzeEmailWithLLM(email.subject, fullEmail.body, email.from);
            await EmailMemory.updateEmailAnalysis(userId, email.id, analysis);

            analyzedCount++;

            // Emit real-time update for this email
            req.app.get('io')?.to(`sync-updates-${userId}`).emit('email-analyzed', {
              emailId: email.id,
              analysis,
              analyzedCount,
              totalToAnalyze: emailsNeedingAnalysis.length,
            });

            console.log(
              `✅ Analysis complete for email ${analyzedCount}/${emailsNeedingAnalysis.length}`,
            );
          } catch (error) {
            console.error('Error analyzing email:', error);
          }
        }

        // Update last sync time
        await updateLastSyncTime(userId);

        const totalSaved = rawEmails.length - emailsNeedingAnalysis.length;
        const reductionPercentage =
          rawEmails.length > 0 ? Math.round((totalSaved / rawEmails.length) * 100) : 0;

        console.log(`📈 Background analysis complete!
          - Total emails fetched: ${rawEmails.length}
          - New emails stored: ${newEmailsStored}  
          - Emails analyzed: ${analyzedCount}
          - LLM calls reduced by: ${reductionPercentage}%
          - Time saved: ~${Math.round((totalSaved * 30) / 60)} minutes`);

        // Emit final completion event
        req.app
          .get('io')
          ?.to(`sync-updates-${userId}`)
          .emit('sync-complete', {
            totalFetched: rawEmails.length,
            newStored: newEmailsStored,
            analyzed: analyzedCount,
            reductionPercentage,
            timeSaved: `${Math.round((totalSaved * 30) / 60)} minutes`,
          });
      } catch (error) {
        console.error('Error in background analysis:', error);
        req.app.get('io')?.to(`sync-updates-${userId}`).emit('sync-error', {
          error: 'Background analysis failed',
        });
      }
    });
  } catch (error) {
    console.error('Error syncing emails:', error);
    res.status(500).json({ error: 'Failed to sync emails via IMAP' });
  }
});

// Get stored web-dev emails from database
router.get('/emails/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    console.log(`📚 Getting stored web-dev emails for user ${userId}`);

    const webDevEmails = await EmailMemory.getWebDevEmails({
      userId,
      limit: parseInt(limit),
      since: null,
    });

    const formattedEmails = webDevEmails.map((email) => ({
      id: email.email_id,
      subject: email.subject,
      from: email.sender,
      date: email.email_date,
      analysis: email.llm_analysis,
      webLink: 'https://mail.google.com/mail/u/0/#inbox',
      summary: email.llm_analysis?.summary || 'Analysis pending...',
      vectorSimilarity: email.similarity_score?.toFixed(3) || '0.000',
      analyzed: email.llm_analyzed,
      category: email.llm_analysis?.category,
      priority: email.llm_analysis?.priority,
    }));

    console.log(`📊 Found ${formattedEmails.length} stored web-dev emails`);

    res.json({
      emails: formattedEmails,
      total: formattedEmails.length,
      source: 'database',
    });
  } catch (error) {
    console.error('Error getting stored emails:', error);
    res.status(500).json({ error: 'Failed to get stored emails' });
  }
});

export default router;
