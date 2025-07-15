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
      return res.redirect(`${process.env.CLIENT_URL}?error=no_code`);
    }

    if (!userId) {
      return res.redirect(`${process.env.CLIENT_URL}?error=no_user_id`);
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Store tokens in database
    await GoogleCalendar.storeTokens(userId, tokens);

    console.log(`✅ Google Calendar connected for user: ${userId}`);

    // Redirect back to client
    res.redirect(`${process.env.CLIENT_URL}?calendar_connected=true`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.redirect(`${process.env.CLIENT_URL}?error=oauth_failed`);
  }
});

// Disconnect Google Calendar
router.post('/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Delete tokens from database
    await GoogleCalendar.deleteTokens(userId);

    res.json({ success: true, message: 'Google Calendar disconnected' });
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
  }
});

// Create calendar event (for testing)
router.post('/create-event', async (req, res) => {
  try {
    const { userId, event } = req.body;

    if (!userId || !event) {
      return res.status(400).json({ error: 'User ID and event are required' });
    }

    // Check if user has valid tokens
    const hasValidTokens = await GoogleCalendar.hasValidTokens(userId);
    if (!hasValidTokens) {
      return res.status(401).json({ error: 'Google Calendar not connected' });
    }

    // Set up OAuth2 client with stored tokens
    const tokens = await GoogleCalendar.getTokens(userId);
    oauth2Client.setCredentials(tokens);

    // Create calendar API client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Create the event
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json({
      success: true,
      event: {
        id: response.data.id,
        title: response.data.summary,
        startTime: response.data.start.dateTime,
        endTime: response.data.end.dateTime,
        link: response.data.htmlLink,
      },
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

export default router;
