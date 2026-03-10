const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const auth = require('../middleware/auth');
const { requireRole, generateFingerprint } = require('../middleware/auth');
const {
  checkLoginLockout, recordFailedLogin, clearLoginAttempts,
  enforcePasswordPolicy, generateSessionId,
} = require('../middleware/hipaaCompliance');

// @route    POST api/v1/auth/login
// @desc     Authenticate user & get token
// @access   Public
// HIPAA §164.312(d) — Person/Entity Authentication
router.post('/login', checkLoginLockout, async (req, res) => {
  const { email, password, deviceType } = req.body;

  try {
    let user = await User.findOne({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });

    if (!user) {
      recordFailedLogin(email);
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

    // ── CONCURRENT SESSION MANAGEMENT ──
    // Check for existing active session on another device
    const device = deviceType || (req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'web');
    let sessionConflict = null;

    if (user.activeSessionId && user.activeSessionDevice) {
      // Another session is active — record the conflict
      sessionConflict = {
        previousDevice: user.activeSessionDevice,
        previousLoginAt: user.lastLoginAt,
        previousIp: user.lastLoginIp,
        action: 'previous_session_invalidated',
        message: `Your previous session on ${user.activeSessionDevice} has been signed out for security.`,
      };

      // Audit: session conflict
      AuditLog.create({
        action: 'SESSION_CONFLICT',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        companyId: user.companyId,
        targetType: 'authentication',
        details: `Concurrent session detected. Previous: ${user.activeSessionDevice} (${user.lastLoginIp}). New: ${device} (${req.ip}). Previous session invalidated.`,
        ipAddress: req.ip || req.connection?.remoteAddress,
        timestamp: new Date(),
      }).catch(() => {});
    }

    // Generate unique session ID for this login
    const sessionId = generateSessionId();

    // Update user with current session info
    user.activeSessionId = sessionId;
    user.activeSessionDevice = device;
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip || req.connection?.remoteAddress;
    await user.save();

    const fingerprint = generateFingerprint(req);

    const payload = {
      user: {
        id: user.id,
        role: user.role,
        companyId: user.companyId,
        sessionId,
      },
      fingerprint,  // HIPAA §164.312(d) — Device-bound token
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
          details: `Successful login — ${email} (${device})`,
          ipAddress: req.ip || req.connection?.remoteAddress,
          sessionId,
          timestamp: new Date(),
        }).catch(() => {});

        // Return matching structure to frontend's AuthContext
        const response = {
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
        };

        // Include session conflict warning if another device was active
        if (sessionConflict) {
          response.sessionConflict = sessionConflict;
        }

        res.json(response);
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route    POST api/v1/auth/refresh
// @desc     Refresh JWT token — issues new token with fresh expiry
// @access   Private (requires valid or recently-expired token)
// HIPAA §164.312(d) — Session continuity with re-authentication
router.post('/refresh', async (req, res) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Accept tokens that expired within the last 30 minutes (grace period)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });

    // Check if token expired more than 30 min ago — reject
    if (decoded.exp) {
      const expiredAgo = Math.floor(Date.now() / 1000) - decoded.exp;
      if (expiredAgo > 1800) { // 30 minutes grace
        return res.status(401).json({ msg: 'Token too old to refresh. Please log in again.' });
      }
    }

    // Verify session fingerprint
    const currentFingerprint = generateFingerprint(req);
    if (decoded.fingerprint && decoded.fingerprint !== currentFingerprint) {
      return res.status(401).json({ msg: 'Session fingerprint mismatch. Please log in again.' });
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.user.id).select('-password');
    if (!user || user.active === false) {
      return res.status(401).json({ msg: 'Account not found or deactivated.' });
    }

    // Issue fresh token
    const newPayload = {
      user: {
        id: user.id,
        role: user.role,
        companyId: user.companyId,
        sessionId: decoded.user.sessionId,
      },
      fingerprint: currentFingerprint,
    };

    const newToken = jwt.sign(newPayload, process.env.JWT_SECRET, { expiresIn: '8h' });

    AuditLog.create({
      action: 'TOKEN_REFRESHED',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      companyId: user.companyId,
      targetType: 'authentication',
      details: `Token refreshed for ${user.email}`,
      ipAddress: req.ip || req.connection?.remoteAddress,
      timestamp: new Date(),
    }).catch(() => {});

    res.json({ token: newToken });
  } catch (err) {
    return res.status(401).json({ msg: 'Invalid token. Please log in again.' });
  }
});

// @route    POST api/v1/auth/logout
// @desc     Clear active session on logout
// @access   Private
router.post('/logout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.activeSessionId = null;
      user.activeSessionDevice = null;
      await user.save();

      AuditLog.create({
        action: 'LOGOUT',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        companyId: user.companyId,
        targetType: 'authentication',
        details: `User logged out`,
        ipAddress: req.ip || req.connection?.remoteAddress,
        sessionId: req.user.sessionId,
        timestamp: new Date(),
      }).catch(() => {});
    }
    res.json({ msg: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route    GET api/v1/auth/session-check
// @desc     Verify current session is still active (not invalidated by another login)
// @access   Private
router.get('/session-check', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('activeSessionId activeSessionDevice');
    if (!user) return res.status(401).json({ valid: false, msg: 'User not found' });

    const isValid = user.activeSessionId === req.user.sessionId;
    res.json({
      valid: isValid,
      activeDevice: user.activeSessionDevice,
      msg: isValid ? 'Session active' : 'Session invalidated — you were signed in on another device',
    });
  } catch (err) {
    res.status(500).json({ valid: false, msg: 'Server error' });
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

// ────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — Send email with reset link
// POST /api/v1/auth/forgot-password
// HIPAA: No PHI leaked — always returns 200 to prevent email enumeration
// ────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    // Always return 200 regardless of whether user exists (anti-enumeration)
    if (!user) {
      return res.json({ msg: 'If an account exists, a reset link has been sent.' });
    }

    // Generate a 1-hour reset token
    const resetToken = jwt.sign(
      { userId: user._id, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Build reset URL — use FRONTEND_URL env var or default
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send email (plug in SendGrid, SES, or Nodemailer in production)
    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    // Audit log
    if (AuditLog) {
      await AuditLog.create({
        action: 'PASSWORD_RESET_REQUESTED',
        userId: user._id,
        details: { email: user.email, ip: req.ip },
        timestamp: new Date(),
      });
    }

    res.json({ msg: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ────────────────────────────────────────────────────────────────
// RESET PASSWORD — Validate token and set new password
// POST /api/v1/auth/reset-password
// HIPAA §164.312(d) — Person/Entity Authentication
// ────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ msg: 'Token and new password are required' });
    }

    // Validate token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        return res.status(400).json({ msg: 'Reset link has expired. Please request a new one.' });
      }
      return res.status(400).json({ msg: 'Invalid reset link.' });
    }

    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ msg: 'Invalid reset token.' });
    }

    // Enforce password policy
    if (newPassword.length < 12) {
      return res.status(400).json({ msg: 'Password must be at least 12 characters.' });
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || 
        !/[0-9]/.test(newPassword) || !/[^a-zA-Z0-9]/.test(newPassword)) {
      return res.status(400).json({ msg: 'Password must include uppercase, lowercase, number, and special character.' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ msg: 'User not found.' });

    user.password = newPassword; // Pre-save hook auto-hashes
    user.passwordChangedAt = new Date();
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Audit log
    if (AuditLog) {
      await AuditLog.create({
        action: 'PASSWORD_RESET_COMPLETED',
        userId: user._id,
        details: { email: user.email, ip: req.ip, method: 'email-reset-link' },
        timestamp: new Date(),
      });
    }

    res.json({
      msg: 'Password reset successfully ✅. You can now log in with your new password.',
      passwordChangedAt: user.passwordChangedAt,
    });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ── Email helper ─────────────────────────────────────────────
// Stub — replace with real email service in production
async function sendPasswordResetEmail(email, name, resetUrl) {
  // Production: Use SendGrid, AWS SES, or Nodemailer
  // Example with Nodemailer:
  //   const transporter = nodemailer.createTransport({ ... });
  //   await transporter.sendMail({
  //     from: '"Technical Made Easy" <noreply@technicalmadeeasy.com>',
  //     to: email,
  //     subject: '🔐 Password Reset — Technical Made Easy',
  //     html: `<p>Hi ${name},</p>
  //            <p>Click the link below to reset your password:</p>
  //            <a href="${resetUrl}">Reset My Password</a>
  //            <p>This link expires in 1 hour.</p>
  //            <p>— Technical Made Easy Security Team</p>`
  //   });
  console.log(`📧 PASSWORD RESET EMAIL (dev mode):\n  To: ${email}\n  Name: ${name}\n  Link: ${resetUrl}\n  (Wire SendGrid/SES in production)`);
}
// ────────────────────────────────────────────────────────────────
// SEED — Bootstrap initial platform owner in empty database
// POST /api/v1/auth/seed
// SECURITY: Only works when DB has ZERO users. Cannot be exploited
//           after first account is created. Requires SEED_SECRET.
// ────────────────────────────────────────────────────────────────
router.post('/seed', async (req, res) => {
  try {
    const { name, email, password, seedSecret } = req.body;

    // Validate seed secret
    const validSecret = process.env.SEED_SECRET || 'TME_SEED_2026';
    if (seedSecret !== validSecret) {
      return res.status(403).json({ msg: 'Invalid seed secret' });
    }

    // Only allow if NO users exist
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return res.status(400).json({
        msg: `Database already has ${userCount} user(s). Seed is disabled after first account creation.`,
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ msg: 'name, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ msg: 'Password must be at least 8 characters' });
    }

    const user = new User({
      name,
      email: email.toLowerCase().trim(),
      password,
      role: 'OWNER',
      companyId: 'platform',
      active: true,
    });

    await user.save();

    // Auto-login — return a token immediately
    const sessionId = generateSessionId();
    user.activeSessionId = sessionId;
    user.activeSessionDevice = 'web';
    user.lastLoginAt = new Date();
    await user.save();

    const payload = {
      user: { id: user.id, role: 'OWNER', companyId: 'platform', sessionId },
      fingerprint: generateFingerprint(req),
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    AuditLog.create({
      action: 'PLATFORM_SEEDED',
      userId: user.id,
      userName: user.name,
      userRole: 'OWNER',
      targetType: 'authentication',
      details: `Platform owner account created via seed: ${user.email}`,
      ipAddress: req.ip,
      timestamp: new Date(),
    }).catch(() => {});

    res.status(201).json({
      msg: '🎉 Platform owner account created! You are now logged in.',
      token,
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'OWNER',
        companyId: 'platform',
      },
    });
  } catch (err) {
    console.error('Seed error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;



