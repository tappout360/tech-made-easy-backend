const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

module.exports = router;
