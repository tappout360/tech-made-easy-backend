const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const User = require('../models/User');

// @route    GET api/v1/users
// @desc     Get all users (for admin panels, user management)
// @access   Private — OWNER, COMPANY, ADMIN only
router.get('/', auth, requireRole('OWNER', 'COMPANY', 'ADMIN'), async (req, res) => {
  try {
    const query = {};
    // COMPANY/ADMIN users can only see users in their company
    if (req.user.role !== 'OWNER' && req.user.companyId) {
      query.companyId = req.user.companyId;
    }
    if (req.query.role) query.role = req.query.role;
    if (req.query.active) query.active = req.query.active === 'true';

    const users = await User.find(query)
      .select('-password')
      .sort({ name: 1 });

    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/v1/users/techs
// @desc     Get tech users only (for WO assignment dropdowns)
// @access   Private
router.get('/techs', auth, async (req, res) => {
  try {
    const query = { role: 'TECH', active: true };
    if (req.user.companyId) query.companyId = req.user.companyId;

    const techs = await User.find(query)
      .select('name email techSkill rating')
      .sort({ name: 1 });

    res.json(techs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
