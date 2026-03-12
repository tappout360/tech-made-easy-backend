const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Webhook = require('../models/Webhook');
const AuditLog = require('../models/AuditLog');

/**
 * ═══════════════════════════════════════════════════════════════════
 * WEBHOOK MANAGEMENT ROUTES
 * CRUD for webhook registrations + test delivery
 * ═══════════════════════════════════════════════════════════════════
 */

// @route    GET api/v1/webhooks
router.get('/', auth, async (req, res) => {
  try {
    const hooks = await Webhook.find({ companyId: req.user.companyId }).sort({ createdAt: -1 });
    res.json(hooks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/webhooks
router.post('/', auth, async (req, res) => {
  try {
    if (!['COMPANY', 'OWNER', 'ADMIN', 'PLATFORM_OWNER'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Only admins can create webhooks' });
    }

    // Validate URL is HTTPS
    const url = req.body.url;
    if (!url || !url.startsWith('https://')) {
      return res.status(400).json({ msg: 'Webhook URL must use HTTPS' });
    }

    const hook = await Webhook.create({
      ...req.body,
      companyId: req.user.companyId,
      createdBy: req.user.id,
    });

    await AuditLog.create({
      action: 'WEBHOOK_CREATED', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'webhook', targetId: hook._id.toString(),
      details: `Webhook "${hook.name}" created for events: ${hook.events.join(', ')}`,
    });

    res.status(201).json(hook);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/v1/webhooks/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const hook = await Webhook.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!hook) return res.status(404).json({ msg: 'Webhook not found' });
    res.json(hook);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/v1/webhooks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const hook = await Webhook.findByIdAndDelete(req.params.id);
    if (!hook) return res.status(404).json({ msg: 'Webhook not found' });
    res.json({ msg: 'Webhook deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/webhooks/:id/test
// @desc     Send a test event to verify the endpoint works
router.post('/:id/test', auth, async (req, res) => {
  try {
    const hook = await Webhook.findById(req.params.id);
    if (!hook) return res.status(404).json({ msg: 'Webhook not found' });

    const testPayload = JSON.stringify({
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'TME webhook test — this is not a real event', woNumber: 'WO-TEST-001' },
    });

    const response = await fetch(hook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TME-Event': 'test' },
      body: testPayload,
    });

    res.json({
      success: response.ok,
      status: response.status,
      msg: response.ok ? 'Test delivered successfully' : `Endpoint returned ${response.status}`,
    });
  } catch (err) {
    res.json({ success: false, msg: `Connection failed: ${err.message}` });
  }
});

module.exports = router;
