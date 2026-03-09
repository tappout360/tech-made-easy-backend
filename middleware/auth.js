/* ═══════════════════════════════════════════════════════════════════
   AUTH & RBAC MIDDLEWARE
   Technical Made Easy — HIPAA §164.308(a)(4)
   
   Roles hierarchy (top → bottom):
   ┌────────────────────┐
   │  PLATFORM_OWNER    │ ← Jason Mounts — supreme admin over ALL companies
   │  OWNER             │ ← Company owner — controls their company
   │  COMPANY           │ ← Company-level (alias for owner)
   │  ADMIN             │ ← Company admin
   │  OFFICE            │ ← Office staff
   │  TECH              │ ← Field technician
   │  CLIENT            │ ← Facility client (read-only portal)
   └────────────────────┘
   
   Data Isolation:
   - Every user belongs to a companyId (except PLATFORM_OWNER)
   - Every query MUST be scoped to the user's companyId
   - Company accounts have unique companyAccountNumber (TME-C-XXXX)
   - Client accounts have unique accountNumber (TME-CL-XXXX)
   - PLATFORM_OWNER bypasses companyId scoping (can see all)
   ═══════════════════════════════════════════════════════════════════ */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/* ── Session Fingerprint Generator ─────────────────────────────── */
// Creates a hash of the user's device characteristics for token binding
// HIPAA §164.312(d) — Person/Entity Authentication hardening
function generateFingerprint(req) {
  const raw = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

/* ── JWT Authentication ────────────────────────────────────────── */
const auth = function (req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;

    // Session fingerprint verification — reject stolen tokens
    if (decoded.fingerprint) {
      const currentFingerprint = generateFingerprint(req);
      if (decoded.fingerprint !== currentFingerprint) {
        return res.status(401).json({ msg: 'Session fingerprint mismatch. Please log in again.' });
      }
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

/* ── Role-Based Access Control ─────────────────────────────────── */
// PLATFORM_OWNER always passes role checks — supreme admin
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ msg: 'Authentication required' });
    }
    // PLATFORM_OWNER bypasses all role restrictions
    if (req.user.role === 'PLATFORM_OWNER' || req.user.platformOwner === true) {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ msg: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
};

/* ── Data Isolation Middleware ──────────────────────────────────── 
   Ensures every data query is scoped to the user's companyId.
   PLATFORM_OWNER can optionally pass ?companyId=X to view any company.
   Everyone else is locked to their own companyId.
   
   Usage: router.get('/workorders', auth, enforceDataIsolation, ...)
   Then use req.scopedCompanyId in your controller queries.
   ─────────────────────────────────────────────────────────────── */
const enforceDataIsolation = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ msg: 'Authentication required for data access' });
  }

  // PLATFORM_OWNER can view any company (or all if no filter)
  if (req.user.role === 'PLATFORM_OWNER' || req.user.platformOwner === true) {
    // If they pass ?companyId, scope to that company; otherwise null = all
    req.scopedCompanyId = req.query.companyId || req.body?.companyId || null;
    req.isPlatformOwner = true;
    return next();
  }

  // Everyone else: MUST have a companyId
  if (!req.user.companyId) {
    return res.status(403).json({ msg: 'Account not associated with any company. Contact your administrator.' });
  }

  // Lock to their companyId — no override possible
  req.scopedCompanyId = req.user.companyId;
  req.isPlatformOwner = false;

  // Prevent users from trying to access another company's data via query params
  if (req.query.companyId && req.query.companyId !== req.user.companyId) {
    return res.status(403).json({ msg: 'Access denied. Cannot access data from another company.' });
  }
  if (req.body?.companyId && req.body.companyId !== req.user.companyId) {
    return res.status(403).json({ msg: 'Access denied. Cannot modify data for another company.' });
  }

  next();
};

/* ── Platform Owner Guard ──────────────────────────────────────── 
   Only PLATFORM_OWNER (Jason Mounts) can access these routes.
   Used for: user management across all companies, system config,
   emergency access, global analytics.
   ─────────────────────────────────────────────────────────────── */
const requirePlatformOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ msg: 'Authentication required' });
  }
  if (req.user.role !== 'PLATFORM_OWNER' && req.user.platformOwner !== true) {
    return res.status(403).json({ msg: 'Access denied. Platform Owner privileges required.' });
  }
  next();
};

/* ── Company Owner Guard ───────────────────────────────────────── 
   Ensures the user is the OWNER/COMPANY of their specific company.
   They can manage their team but cannot see other companies.
   ─────────────────────────────────────────────────────────────── */
const requireCompanyOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ msg: 'Authentication required' });
  }
  // PLATFORM_OWNER always passes
  if (req.user.role === 'PLATFORM_OWNER' || req.user.platformOwner === true) {
    return next();
  }
  if (req.user.role !== 'OWNER' && req.user.role !== 'COMPANY') {
    return res.status(403).json({ msg: 'Access denied. Company Owner privileges required.' });
  }
  next();
};

module.exports = auth;
module.exports.requireRole = requireRole;
module.exports.enforceDataIsolation = enforceDataIsolation;
module.exports.requirePlatformOwner = requirePlatformOwner;
module.exports.requireCompanyOwner = requireCompanyOwner;
module.exports.generateFingerprint = generateFingerprint;
