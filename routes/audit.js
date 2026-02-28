const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

// @route    GET api/v1/audit
// @desc     Get audit log entries (READ-ONLY, no delete/update endpoints exist)
// @access   Private (OWNER, COMPANY, ADMIN only)
router.get('/', auth, async (req, res) => {
  try {
    // Only senior roles can view audit logs
    if (!['OWNER', 'COMPANY', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Insufficient permissions to view audit logs' });
    }

    const query = {};

    // OWNER sees all, others see their company only
    if (req.user.role !== 'OWNER') {
      query.companyId = req.user.companyId;
    } else if (req.query.companyId) {
      query.companyId = req.query.companyId;
    }

    // Filter by action type
    if (req.query.action) query.action = req.query.action;
    // Filter by user
    if (req.query.userId) query.userId = req.query.userId;
    // Filter by target type
    if (req.query.targetType) query.targetType = req.query.targetType;
    // Date range
    if (req.query.from || req.query.to) {
      query.timestamp = {};
      if (req.query.from) query.timestamp.$gte = new Date(req.query.from);
      if (req.query.to) query.timestamp.$lte = new Date(req.query.to);
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(query)
    ]);

    res.json({
      entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/audit
// @desc     Create an audit log entry (used by other services/middleware)
// @access   Private
router.post('/', auth, async (req, res) => {
  try {
    const entry = new AuditLog({
      ...req.body,
      userId: req.body.userId || req.user.id,
      companyId: req.body.companyId || req.user.companyId,
      ipAddress: req.ip || req.connection?.remoteAddress
    });
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// NOTE: No PUT or DELETE routes. Audit logs are immutable per HIPAA/21 CFR Part 11.

module.exports = router;
