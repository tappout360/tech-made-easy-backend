const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const {
  checkLoginLockout, recordFailedLogin, clearLoginAttempts,
  enforcePasswordPolicy, generateSessionId,
} = require('../middleware/hipaaCompliance');

// @route    POST api/v1/auth/login
// @desc     Authenticate user & get token
// @access   Public
// HIPAA §164.312(d) — Person/Entity Authentication
router.post('/login', checkLoginLockout, async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });

    if (!user) {
      recordFailedLogin(email);
      // Audit: failed login attempt — unknown user
      AuditLog.create({
        action: 'LOGIN_FAILED',
        userId: 'unknown',
        userName: email,
        userRole: 'unknown',
        targetType: 'authentication',
        details: `Failed login: email not found — ${email}`,
        ipAddress: req.ip || req.connection?.remoteAddress,
        timestamp: new Date(),
      }).catch(() => {});
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // HIPAA §164.308(a)(3)(ii) — Reject deactivated accounts
    if (user.active === false) {
      AuditLog.create({
        action: 'LOGIN_DENIED_DEACTIVATED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        companyId: user.companyId,
        targetType: 'authentication',
        details: `Login denied: account deactivated — ${email}`,
        ipAddress: req.ip || req.connection?.remoteAddress,
        timestamp: new Date(),
      }).catch(() => {});
      return res.status(403).json({ msg: 'Account deactivated. Contact your administrator.' });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      recordFailedLogin(email);
      // Audit: failed login — wrong password
      AuditLog.create({
        action: 'LOGIN_FAILED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        companyId: user.companyId,
        targetType: 'authentication',
        details: `Failed login: incorrect password — ${email}`,
        ipAddress: req.ip || req.connection?.remoteAddress,
        timestamp: new Date(),
      }).catch(() => {});
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // Success — clear lockout counter
    clearLoginAttempts(email);

    // Generate unique session ID for tracking
    const sessionId = generateSessionId();

    const payload = {
      user: {
        id: user.id,
        role: user.role,
        companyId: user.companyId,
        sessionId, // Track session for audit trail
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '8h' },
      (err, token) => {
        if (err) throw err;

        // Audit: successful login
        AuditLog.create({
          action: 'LOGIN_SUCCESS',
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          companyId: user.companyId,
          targetType: 'authentication',
          details: `Successful login — ${email}`,
          ipAddress: req.ip || req.connection?.remoteAddress,
          sessionId,
          timestamp: new Date(),
        }).catch(() => {});

        // Return matching structure to frontend's AuthContext
        res.json({
          token,
          sessionId,
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
router.post('/register', auth, requireRole('OWNER', 'COMPANY', 'ADMIN'), enforcePasswordPolicy, async (req, res) => {
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

    // Audit: user created
    AuditLog.create({
      action: 'USER_CREATED',
      userId: req.user.id,
      userName: req.user.name || 'Admin',
      userRole: req.user.role,
      companyId: req.user.companyId,
      targetType: 'user',
      targetId: user.id,
      details: `Created user: ${user.name} (${user.email}) with role ${user.role}`,
      ipAddress: req.ip,
      timestamp: new Date(),
    }).catch(() => {});

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
// @desc     Get current user (includes password expiry warning)
// @access   Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Password expiry check — SOFT WARNING, never locks out
    const response = user.toObject();
    const daysSinceChange = (Date.now() - new Date(user.passwordChangedAt || user.createdAt)) / (24 * 60 * 60 * 1000);
    const expiryDays = user.passwordExpiryDays || 90;
    const daysRemaining = Math.max(0, Math.round(expiryDays - daysSinceChange));
    const warningThreshold = expiryDays * 0.8; // Warn at 80% of expiry period

    if (daysSinceChange >= warningThreshold) {
      response.passwordWarning = {
        expired: daysSinceChange >= expiryDays,
        daysRemaining,
        message: daysSinceChange >= expiryDays
          ? `Your password expired ${Math.abs(daysRemaining)} day(s) ago. Please update it for security.`
          : `Your password expires in ${daysRemaining} day(s). Please update it soon.`,
        changeUrl: '/settings/security',    // Deep link for web app
        mobileRoute: 'ChangePassword',      // Screen name for mobile app
      };
    }

    res.json(response);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route    POST api/v1/auth/change-password
// @desc     Change password with easy flow — works from web + mobile deep links
// @access   Private
// HIPAA §164.308(a)(5)(ii)(D) — Password Management
router.post('/change-password', auth, enforcePasswordPolicy, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: 'Both current and new password are required' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ msg: 'New password must be different from current password' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Current password is incorrect' });
    }

    // Update password (pre-save hook handles hashing + passwordChangedAt)
    user.password = newPassword;
    await user.save();

    // Audit: password changed
    AuditLog.create({
      action: 'PASSWORD_CHANGED',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      companyId: user.companyId,
      targetType: 'authentication',
      targetId: user.id,
      details: `Password changed successfully`,
      ipAddress: req.ip || req.connection?.remoteAddress,
      timestamp: new Date(),
    }).catch(() => {});

    res.json({
      msg: 'Password updated successfully ✅',
      passwordChangedAt: user.passwordChangedAt,
      nextExpiry: new Date(Date.now() + (user.passwordExpiryDays || 90) * 24 * 60 * 60 * 1000),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;


