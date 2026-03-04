const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

/*
 * Google Calendar Integration
 * 
 * Requires Google OAuth2 credentials:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 * 
 * Flow:
 *   1. GET /connect → redirects to Google consent screen
 *   2. GET /callback → exchanges code for tokens
 *   3. POST /sync-wo → creates a calendar event from a WO
 *   4. GET /events → lists upcoming events
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/v1/calendar/callback';

// In-memory token store (production: store in DB per user)
const tokenStore = {};

// @route    GET api/v1/calendar/connect
// @desc     Redirect user to Google OAuth consent screen
// @access   Private
router.get('/connect', auth, (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(400).json({ msg: 'Google Calendar not configured. Set GOOGLE_CLIENT_ID in .env' });
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ];

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes.join(' '))}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${req.user.id}`;

  res.json({ authUrl });
});

// @route    GET api/v1/calendar/callback
// @desc     Handle Google OAuth callback and exchange code for tokens
// @access   Public (Google redirect)
router.get('/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    if (!code) return res.status(400).send('Missing authorization code');

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      console.error('Google token error:', tokens);
      return res.status(400).send(`Token exchange failed: ${tokens.error}`);
    }

    // Store tokens (keyed by userId from state param)
    tokenStore[userId] = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000),
    };

    console.log(`[Google Calendar] Connected for user: ${userId}`);

    // Redirect back to frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}?googleCalendar=connected`);
  } catch (err) {
    console.error('Google callback error:', err.message);
    res.status(500).send('Google Calendar connection failed');
  }
});

// @route    GET api/v1/calendar/status
// @desc     Check if Google Calendar is connected for current user
// @access   Private
router.get('/status', auth, (req, res) => {
  const tokens = tokenStore[req.user.id];
  res.json({
    connected: !!tokens,
    expiresAt: tokens?.expires_at ? new Date(tokens.expires_at).toISOString() : null,
  });
});

// Helper: refresh access token if expired
async function getValidToken(userId) {
  const tokens = tokenStore[userId];
  if (!tokens) return null;

  if (Date.now() < tokens.expires_at - 60000) {
    return tokens.access_token;
  }

  // Refresh token
  if (!tokens.refresh_token) return null;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const data = await res.json();
    if (data.access_token) {
      tokens.access_token = data.access_token;
      tokens.expires_at = Date.now() + (data.expires_in * 1000);
      return data.access_token;
    }
  } catch (err) {
    console.error('Token refresh failed:', err.message);
  }
  return null;
}

// @route    POST api/v1/calendar/sync-wo
// @desc     Create a Google Calendar event from a work order
// @access   Private
router.post('/sync-wo', auth, async (req, res) => {
  try {
    const { woNumber, clientName, model, site, scheduledDate, scheduledTime, duration, notes } = req.body;

    const accessToken = await getValidToken(req.user.id);
    if (!accessToken) {
      return res.status(401).json({ msg: 'Google Calendar not connected. Please connect first.', needsAuth: true });
    }

    // Build event
    const startDateTime = scheduledTime
      ? `${scheduledDate}T${scheduledTime}:00`
      : `${scheduledDate}T09:00:00`;

    const durationHours = parseFloat(duration) || 1;
    const endDate = new Date(startDateTime);
    endDate.setHours(endDate.getHours() + durationHours);

    const event = {
      summary: `WO ${woNumber} — ${clientName}`,
      description: [
        `Work Order: ${woNumber}`,
        `Client: ${clientName}`,
        `Equipment: ${model || 'N/A'}`,
        notes ? `Notes: ${notes}` : '',
        `\n— Synced from Technical Made Easy`,
      ].filter(Boolean).join('\n'),
      location: site || '',
      start: {
        dateTime: startDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      colorId: '9', // Blue
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    const calData = await calRes.json();

    if (calData.error) {
      console.error('Calendar event error:', calData.error);
      return res.status(400).json({ msg: calData.error.message || 'Failed to create event' });
    }

    res.json({
      msg: 'Event created',
      eventId: calData.id,
      htmlLink: calData.htmlLink,
      start: calData.start,
      end: calData.end,
    });
  } catch (err) {
    console.error('Calendar sync error:', err.message);
    res.status(500).json({ msg: 'Failed to sync WO to calendar' });
  }
});

// @route    GET api/v1/calendar/events
// @desc     List upcoming calendar events
// @access   Private
router.get('/events', auth, async (req, res) => {
  try {
    const accessToken = await getValidToken(req.user.id);
    if (!accessToken) {
      return res.status(401).json({ msg: 'Google Calendar not connected', needsAuth: true });
    }

    const now = new Date().toISOString();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 14); // Next 2 weeks

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(maxDate.toISOString())}` +
      `&maxResults=50&singleEvents=true&orderBy=startTime`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    const data = await calRes.json();

    if (data.error) {
      return res.status(400).json({ msg: data.error.message });
    }

    res.json({
      events: (data.items || []).map(e => ({
        id: e.id,
        title: e.summary,
        description: e.description,
        location: e.location,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        htmlLink: e.htmlLink,
      })),
    });
  } catch (err) {
    console.error('Events fetch error:', err.message);
    res.status(500).json({ msg: 'Failed to fetch events' });
  }
});

// @route    DELETE api/v1/calendar/disconnect
// @desc     Disconnect Google Calendar for current user
// @access   Private
router.delete('/disconnect', auth, (req, res) => {
  delete tokenStore[req.user.id];
  res.json({ msg: 'Google Calendar disconnected' });
});

module.exports = router;
