// ═══════════════════════════════════════════════════════════
//  QuickBooks Online OAuth2 Integration
//  Handles: authorize → callback → token storage → refresh
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const Company = require('../models/Company');
const AuditLog = require('../models/AuditLog');

// OAuth2 config from environment
const QB_CLIENT_ID     = process.env.QB_CLIENT_ID;
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET;
const QB_REDIRECT_URI  = process.env.QB_REDIRECT_URI || 'http://localhost:5000/api/v1/quickbooks/callback';
const QB_ENVIRONMENT   = process.env.QB_ENVIRONMENT || 'sandbox';

const QB_AUTH_URL  = 'https://appcenter.intuit.com/connect/oauth2';
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_BASE_API  = QB_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';

// ── Step 1: Initiate OAuth ─────────────────────────────
// @route    GET api/v1/quickbooks/authorize
// @desc     Redirect user to QuickBooks OAuth consent screen
// @access   Private (COMPANY or ADMIN)
router.get('/authorize', auth, (req, res) => {
  if (!['COMPANY', 'OWNER', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ msg: 'Insufficient permissions' });
  }

  if (!QB_CLIENT_ID) {
    return res.status(500).json({ msg: 'QuickBooks OAuth not configured. Set QB_CLIENT_ID in .env' });
  }

  // CSRF protection state token
  const state = `${req.user.companyId}:${crypto.randomBytes(16).toString('hex')}`;

  const params = new URLSearchParams({
    client_id: QB_CLIENT_ID,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: QB_REDIRECT_URI,
    state: state,
  });

  const url = `${QB_AUTH_URL}?${params.toString()}`;
  res.json({ url, state });
});

// ── Step 2: OAuth Callback ─────────────────────────────
// @route    GET api/v1/quickbooks/callback
// @desc     Handle QuickBooks OAuth callback, exchange code for tokens
// @access   Public (QuickBooks redirects here)
router.get('/callback', async (req, res) => {
  const { code, state, realmId, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?qb_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state || !realmId) {
    return res.status(400).json({ msg: 'Missing required OAuth parameters' });
  }

  const companyId = state.split(':')[0];

  try {
    // Exchange authorization code for tokens
    const basicAuth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64');

    const tokenRes = await fetch(QB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: QB_REDIRECT_URI,
      }).toString()
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error('QB Token Error:', tokenData);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?qb_error=token_exchange_failed`);
    }

    // Store tokens in company record
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await Company.findByIdAndUpdate(companyId, {
      $set: {
        'integrations.quickbooks': {
          connected: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          realmId: realmId,
          tokenExpiresAt: tokenExpiresAt
        }
      }
    });

    // Audit log
    await new AuditLog({
      action: 'QUICKBOOKS_CONNECTED',
      userId: 'OAUTH_CALLBACK',
      companyId: companyId,
      targetType: 'integration',
      details: `QuickBooks Online connected. RealmID: ${realmId}`,
      metadata: { realmId, expiresAt: tokenExpiresAt }
    }).save();

    // Redirect back to frontend with success
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?qb_connected=true&realm=${realmId}`);
  } catch (err) {
    console.error('QB OAuth Error:', err);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?qb_error=server_error`);
  }
});

// ── Token Refresh ──────────────────────────────────────
// @route    POST api/v1/quickbooks/refresh
// @desc     Refresh expired QuickBooks access token
// @access   Private
router.post('/refresh', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);
    if (!company?.integrations?.quickbooks?.refreshToken) {
      return res.status(400).json({ msg: 'QuickBooks not connected' });
    }

    const basicAuth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64');

    const tokenRes = await fetch(QB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: company.integrations.quickbooks.refreshToken,
      }).toString()
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      // Token expired — mark as disconnected
      await Company.findByIdAndUpdate(req.user.companyId, {
        $set: { 'integrations.quickbooks.connected': false }
      });
      return res.status(401).json({ msg: 'Refresh failed — please reconnect QuickBooks' });
    }

    await Company.findByIdAndUpdate(req.user.companyId, {
      $set: {
        'integrations.quickbooks.accessToken': tokenData.access_token,
        'integrations.quickbooks.refreshToken': tokenData.refresh_token,
        'integrations.quickbooks.tokenExpiresAt': new Date(Date.now() + tokenData.expires_in * 1000)
      }
    });

    res.json({ msg: 'Token refreshed', expiresIn: tokenData.expires_in });
  } catch (err) {
    console.error('QB Refresh Error:', err);
    res.status(500).send('Server Error');
  }
});

// ── Connection Status ──────────────────────────────────
// @route    GET api/v1/quickbooks/status
// @desc     Check QuickBooks connection status
// @access   Private
router.get('/status', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);
    const qb = company?.integrations?.quickbooks;

    if (!qb || !qb.connected) {
      return res.json({ connected: false });
    }

    const isExpired = qb.tokenExpiresAt && new Date(qb.tokenExpiresAt) < new Date();

    res.json({
      connected: qb.connected,
      realmId: qb.realmId,
      tokenExpired: isExpired,
      tokenExpiresAt: qb.tokenExpiresAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ── Disconnect ─────────────────────────────────────────
// @route    POST api/v1/quickbooks/disconnect
// @desc     Disconnect QuickBooks integration
// @access   Private (COMPANY or ADMIN)
router.post('/disconnect', auth, async (req, res) => {
  try {
    if (!['COMPANY', 'OWNER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Insufficient permissions' });
    }

    await Company.findByIdAndUpdate(req.user.companyId, {
      $set: {
        'integrations.quickbooks': {
          connected: false,
          accessToken: null,
          refreshToken: null,
          realmId: null,
          tokenExpiresAt: null
        }
      }
    });

    await new AuditLog({
      action: 'QUICKBOOKS_DISCONNECTED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'integration',
      details: 'QuickBooks Online disconnected'
    }).save();

    res.json({ msg: 'QuickBooks disconnected' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ── Create Invoice ─────────────────────────────────────
// @route    POST api/v1/quickbooks/invoice
// @desc     Create an invoice in QuickBooks from a work order
// @access   Private
router.post('/invoice', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);
    const qb = company?.integrations?.quickbooks;

    if (!qb?.connected || !qb.accessToken) {
      return res.status(400).json({ msg: 'QuickBooks not connected' });
    }

    const { customerName, lineItems, woNumber } = req.body;

    // Build QuickBooks invoice payload
    const invoicePayload = {
      Line: lineItems.map((item, i) => ({
        Amount: item.amount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: '1', name: 'Services' },
          Qty: item.qty || 1,
          UnitPrice: item.unitPrice || item.amount,
        },
        Description: item.description || `WO ${woNumber} - ${item.name || 'Service'}`
      })),
      CustomerRef: { value: '1', name: customerName },
      PrivateNote: `Generated from Technical Made Easy WO: ${woNumber}`,
    };

    const qbRes = await fetch(
      `${QB_BASE_API}/v3/company/${qb.realmId}/invoice`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${qb.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(invoicePayload)
      }
    );

    const invoiceData = await qbRes.json();

    if (!qbRes.ok) {
      console.error('QB Invoice Error:', invoiceData);
      return res.status(qbRes.status).json({ msg: 'Failed to create invoice in QuickBooks', details: invoiceData });
    }

    // Audit log
    await new AuditLog({
      action: 'QUICKBOOKS_INVOICE_CREATED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'billing',
      details: `Invoice created in QuickBooks for WO ${woNumber}. Customer: ${customerName}`,
      metadata: { woNumber, qbInvoiceId: invoiceData?.Invoice?.Id }
    }).save();

    res.json({
      msg: 'Invoice created',
      invoiceId: invoiceData?.Invoice?.Id,
      invoiceNumber: invoiceData?.Invoice?.DocNumber,
      total: invoiceData?.Invoice?.TotalAmt
    });
  } catch (err) {
    console.error('QB Invoice Error:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
