const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// @route    GET api/v1/notifications
// @desc     Get notifications for current user
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    const query = { userId: req.user.id };
    if (req.query.unread === 'true') query.read = false;

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      read: false
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/v1/notifications/:id/read
// @desc     Mark notification as read
// @access   Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ msg: 'Notification not found' });
    res.json(notif);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/v1/notifications/read-all
// @desc     Mark all notifications as read
// @access   Private
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true }
    );
    res.json({ msg: 'All notifications marked as read' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/notifications
// @desc     Create a notification (message, alert, etc.)
// @access   Private
router.post('/', auth, async (req, res) => {
  try {
    const { type, title, message, threadId, toUserId, fromName, fromRole } = req.body;
    const notif = new Notification({
      userId: toUserId || req.user.id,
      type: type || 'message',
      title: title || 'New Message',
      message: message || '',
      threadId: threadId || 'dispatch',
      fromUserId: req.user.id,
      fromName: fromName || req.user.name || 'System',
      fromRole: fromRole || req.user.role || 'SYSTEM',
      read: false,
    });
    await notif.save();
    res.status(201).json(notif);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/notifications/register-device
// @desc     Register a mobile device for push notifications
// @access   Private
router.post('/register-device', auth, async (req, res) => {
  try {
    const { token, platform, deviceName } = req.body;
    // Store push token — in production, save to User model or a PushDevice collection
    console.log(`[Push] Device registered: ${platform} — ${deviceName} — token: ${token?.substring(0, 20)}...`);
    res.json({ msg: 'Device registered', token: token?.substring(0, 20) });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
