import { Router } from 'express';
import EmailMemory from '../models/EmailMemory.js';
import GmailSync from '../models/GmailSync.js';
import { testImapConnection, getEmailsViaImap } from '../utils/gmailImap.js';
import { analyzeEmailWithLLM } from '../utils/emailAnalysis.js';
import { preFilterWebDevEmails } from '../utils/vectorSimilarity.js';

const router = Router();

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
    const lastSync = await GmailSync.getLastSyncTime(userId);

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
    await GmailSync.initializeSyncStatus(userId);

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

// Persistent vector-powered email sync - now with real-time updates
router.post('/sync', async (req, res) => {
  try {
    const { userId } = req.body;

    console.log('🚀 Starting persistent vector-powered email sync...');

    // Get last sync time for tracking purposes
    const lastSync = await GmailSync.getLastSyncTime(userId);

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
        await GmailSync.updateLastSyncTime(userId);

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
