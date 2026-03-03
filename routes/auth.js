const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

// @route    POST api/v1/auth/login
// @desc     Authenticate user & get token
// @access   Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // HIPAA §164.308(a)(3)(ii) — Reject deactivated accounts
    if (user.active === false) {
      return res.status(403).json({ msg: 'Account deactivated. Contact your administrator.' });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role,
        companyId: user.companyId
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '8h' },
      (err, token) => {
        if (err) throw err;
        // Return matching structure to frontend's AuthContext
        res.json({
          token,
          user: {
            id: user.id,
            role: user.role,
            name: user.name,
            email: user.email,
            companyId: user.companyId,
            accountNumber: user.accountNumber,
            avatar: user.avatar,
            preferences: user.preferences,
            clientCompany: user.clientCompany,
            techSkill: user.techSkill
          }
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route    POST api/v1/auth/register
// @desc     Create a new user (in-app only — NO public signup)
// @access   Private — OWNER, COMPANY, or ADMIN only
// HIPAA §164.308(a)(4) — Access Authorization
router.post('/register', auth, requireRole('OWNER', 'COMPANY', 'ADMIN'), async (req, res) => {
  const { name, email, password, role, companyId, accountNumber, techSkill, clientCompany } = req.body;

  try {
    // Check if user already exists
    let existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ msg: 'User with that email already exists' });
    }

    // Validate role assignment — only OWNER can create COMPANY-level users
    const creatorRole = req.user.role;
    const restrictedRoles = ['OWNER'];
    if (restrictedRoles.includes(role) && creatorRole !== 'OWNER') {
      return res.status(403).json({ msg: 'Only the platform OWNER can create OWNER accounts' });
    }
    if (role === 'COMPANY' && creatorRole !== 'OWNER') {
      return res.status(403).json({ msg: 'Only the platform OWNER can create COMPANY accounts' });
    }

    const user = new User({
      name,
      email,
      password,
      role: role || 'TECH',
      companyId: companyId || req.user.companyId, // Default to creator's company
      accountNumber: accountNumber || null,
      techSkill: techSkill || null,
      clientCompany: clientCompany || null,
      active: true,
    });

    await user.save();

    res.status(201).json({
      msg: 'User created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route    GET api/v1/auth/me
// @desc     Get current user
// @access   Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;

