import { Router } from 'express';
import { google } from 'googleapis';
import GoogleCalendar from '../models/GoogleCalendar.js';

const router = Router();

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// Get Google Calendar connection status
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user has valid tokens
    const hasValidTokens = await GoogleCalendar.hasValidTokens(userId);

    if (!hasValidTokens) {
      return res.json({ connected: false });
    }

    res.json({ connected: true });
  } catch (error) {
    console.error('Error checking Google Calendar status:', error);
    res.status(500).json({ error: 'Failed to check calendar status' });
  }
});

// Start OAuth flow
router.post('/connect', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if already connected
    const hasValidTokens = await GoogleCalendar.hasValidTokens(userId);
    if (hasValidTokens) {
      return res.json({ success: true, message: 'Already connected' });
    }
    // Generate OAuth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar'],
      state: userId, // Pass userId in state to retrieve in callback
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('Error starting OAuth flow:', error);
    res.status(500).json({ error: 'Failed to start OAuth flow' });
  }
});

// Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;

    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL}/oauth-success.html?error=no_code`);
    }

    if (!userId) {
      return res.redirect(`${process.env.CLIENT_URL}/oauth-success.html?error=no_user_id`);
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Store tokens in database
    await GoogleCalendar.storeTokens(userId, tokens);

    // eslint-disable-next-line no-console
    console.log(`✅ Google Calendar connected for user: ${userId}`);

    // Redirect to OAuth success page
    res.redirect(`${process.env.CLIENT_URL}/oauth-success.html?calendar_connected=true`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.redirect(`${process.env.CLIENT_URL}/oauth-success.html?error=oauth_failed`);
  }
});

export default router;
