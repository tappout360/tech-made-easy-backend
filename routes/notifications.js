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

module.exports = router;
