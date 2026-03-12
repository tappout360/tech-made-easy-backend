/* ═══════════════════════════════════════════════════════════════════
   PLATFORM OWNER ADMIN ROUTES
   Technical Made Easy — Jason Mounts Supreme Control
   
   Only PLATFORM_OWNER can access these routes.
   Provides: user management across ALL companies, emergency access,
   company account management, global system oversight.
   
   HIPAA: All actions audit-logged with PLATFORM_OWNER attribution.
   ═══════════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requirePlatformOwner, enforceDataIsolation } = require('../middleware/auth');

let User, AuditLog;
try { User = require('../models/User'); } catch(e) { User = null; }
try { AuditLog = require('../models/AuditLog'); } catch(e) { AuditLog = null; }

// Helper: Create HIPAA audit log entry
const logPlatformAction = async (action, userId, details, req) => {
  if (!AuditLog) return;
  try {
    await AuditLog.create({
      action: `PLATFORM_OWNER_${action}`,
      userId: req.user?.id || 'system',
      targetUserId: userId,
      details,
      ip: req.ip || req.connection?.remoteAddress,
      sessionId: req.headers?.['x-session-id'] || 'platform-admin',
      timestamp: new Date(),
    });
  } catch(e) { console.error('Audit log error:', e.message); }
};

/* ── GET /api/v1/platform/users — List ALL users across ALL companies ── */
router.get('/users', auth, requirePlatformOwner, async (req, res) => {
  try {
    if (!User) return res.status(503).json({ msg: 'User model not available' });
    
    const filter = {};
    // Optional filtering
    if (req.query.companyId) filter.companyId = req.query.companyId;
    if (req.query.role) filter.role = req.query.role;
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';

    const users = await User.find(filter)
      .select('-password -emergencyAccessCode')
      .sort({ role: 1, companyId: 1, name: 1 });
    
    await logPlatformAction('VIEW_ALL_USERS', null, 
      { filter, count: users.length }, req);
    
    res.json({ users, total: users.length });
  } catch(err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/* ── GET /api/v1/platform/companies — List all unique companies ── */
router.get('/companies', auth, requirePlatformOwner, async (req, res) => {
  try {
    if (!User) return res.status(503).json({ msg: 'User model not available' });
    
    const companies = await User.aggregate([
      { $match: { companyId: { $ne: null } } },
      { $group: {
        _id: '$companyId',
        companyName: { $first: '$clientCompany' },
        companyAccountNumber: { $first: '$companyAccountNumber' },
        userCount: { $sum: 1 },
        roles: { $addToSet: '$role' },
        activeUsers: { $sum: { $cond: ['$active', 1, 0] } },
      }},
      { $sort: { _id: 1 } }
    ]);
    
    await logPlatformAction('VIEW_ALL_COMPANIES', null, 
      { count: companies.length }, req);
    
    res.json({ companies, total: companies.length });
  } catch(err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/* ── PUT /api/v1/platform/users/:id/deactivate — Deactivate ANY user ── */
router.put('/users/:id/deactivate', auth, requirePlatformOwner, async (req, res) => {
  try {
    if (!User) return res.status(503).json({ msg: 'User model not available' });
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    // Cannot deactivate self
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ msg: 'Cannot deactivate your own account' });
    }
    
    user.active = false;
    await user.save();
    
    await logPlatformAction('DEACTIVATE_USER', user._id, {
      name: user.name, email: user.email, role: user.role, companyId: user.companyId
    }, req);
    
    res.json({ msg: `User ${user.name} deactivated`, user: { id: user._id, name: user.name, active: false } });
  } catch(err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/* ── PUT /api/v1/platform/users/:id/activate — Reactivate ANY user ── */
router.put('/users/:id/activate', auth, requirePlatformOwner, async (req, res) => {
  try {
    if (!User) return res.status(503).json({ msg: 'User model not available' });
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    user.active = true;
    await user.save();
    
    await logPlatformAction('ACTIVATE_USER', user._id, {
      name: user.name, email: user.email, role: user.role, companyId: user.companyId
    }, req);
    
    res.json({ msg: `User ${user.name} activated`, user: { id: user._id, name: user.name, active: true } });
  } catch(err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/* ── PUT /api/v1/platform/users/:id/role — Change ANY user's role ── */
router.put('/users/:id/role', auth, requirePlatformOwner, async (req, res) => {
  try {
    if (!User) return res.status(503).json({ msg: 'User model not available' });
    
    const { role } = req.body;
    const validRoles = ['PLATFORM_OWNER', 'OWNER', 'COMPANY', 'ADMIN', 'OFFICE', 'TECH', 'CLIENT'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ msg: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    const oldRole = user.role;
    user.role = role;
    
    // If promoting to PLATFORM_OWNER, set the flag too
    if (role === 'PLATFORM_OWNER') user.platformOwner = true;
    
    await user.save();
    
    await logPlatformAction('CHANGE_ROLE', user._id, {
      name: user.name, oldRole, newRole: role, companyId: user.companyId
    }, req);
    
    res.json({ msg: `${user.name} role changed from ${oldRole} to ${role}` });
  } catch(err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/* ── PUT /api/v1/platform/users/:id/transfer — Move user between companies ── */
router.put('/users/:id/transfer', auth, requirePlatformOwner, async (req, res) => {
  try {
    if (!User) return res.status(503).json({ msg: 'User model not available' });
    
    const { newCompanyId, newCompanyAccountNumber } = req.body;
    if (!newCompanyId) return res.status(400).json({ msg: 'newCompanyId required' });
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    const oldCompanyId = user.companyId;
    user.companyId = newCompanyId;
    if (newCompanyAccountNumber) user.companyAccountNumber = newCompanyAccountNumber;
    await user.save();
    
    await logPlatformAction('TRANSFER_USER', user._id, {
      name: user.name, oldCompanyId, newCompanyId
    }, req);
    
    res.json({ msg: `${user.name} transferred from ${oldCompanyId} to ${newCompanyId}` });
  } catch(err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/* ── POST /api/v1/platform/emergency-access — Backup login (emergency only) ── */
router.post('/emergency-access', async (req, res) => {
  try {
    if (!User) return res.status(503).json({ msg: 'User model not available' });
    
    const { email, emergencyCode } = req.body;
    if (!email || !emergencyCode) {
      return res.status(400).json({ msg: 'Email and emergency code required' });
    }
    
    const user = await User.findOne({ email, platformOwner: true });
    if (!user || !user.emergencyAccessCode) {
      // Don't reveal whether user exists
      return res.status(401).json({ msg: 'Emergency access denied' });
    }
    
    // Emergency code is stored hashed (bcrypt)
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(emergencyCode, user.emergencyAccessCode);
    if (!isMatch) {
      await logPlatformAction('EMERGENCY_ACCESS_FAILED', null, { email, ip: req.ip }, req);
      return res.status(401).json({ msg: 'Emergency access denied' });
    }
    
    // Generate token
    const jwt = require('jsonwebtoken');
    const payload = {
      user: {
        id: user._id,
        role: user.role,
        name: user.name,
        email: user.email,
        companyId: user.companyId,
        platformOwner: user.platformOwner,
      }
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' }); // Short-lived for emergency
    
    if (AuditLog) {
      await logPlatformAction('EMERGENCY_ACCESS_SUCCESS', user._id, {
        ip: req.ip,
        note: 'Emergency backup login used — short-lived token (2hr)'
      }, req);
    }
    
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        platformOwner: true,
      },
      warning: 'Emergency access token expires in 2 hours. Change your password immediately.'
    });
  } catch(err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

/* ── GET /api/v1/platform/audit — View ALL audit logs ── */
router.get('/audit', auth, requirePlatformOwner, async (req, res) => {
  try {
    if (!AuditLog) return res.json({ logs: [], msg: 'AuditLog model not available' });
    
    const limit = parseInt(req.query.limit) || 100;
    const skip = parseInt(req.query.skip) || 0;
    const filter = {};
    
    if (req.query.action) filter.action = { $regex: req.query.action, $options: 'i' };
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.companyId) filter.companyId = req.query.companyId;
    
    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await AuditLog.countDocuments(filter);
    
    res.json({ logs, total, limit, skip });
  } catch(err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   INTEGRATION ASSIGNMENT — Platform Owner controls what each company sees
   ═══════════════════════════════════════════════════════════════════ */

let Company;
try { Company = require('../models/Company'); } catch(e) { Company = null; }

const ALL_INTEGRATIONS = [
  { key: 'quickbooks',      label: 'QuickBooks',       category: 'finance',     tier: 'starter' },
  { key: 'stripe',          label: 'Stripe Payments',  category: 'finance',     tier: 'starter' },
  { key: 'google-calendar', label: 'Google Calendar',  category: 'productivity', tier: 'starter' },
  { key: 'google-maps',     label: 'Google Maps',      category: 'productivity', tier: 'starter' },
  { key: 'slack',           label: 'Slack',            category: 'communication', tier: 'starter' },
  { key: 'zoom',            label: 'Zoom',             category: 'communication', tier: 'starter' },
  { key: 'docusign',        label: 'DocuSign',         category: 'documents',   tier: 'professional' },
  { key: 'zapier',          label: 'Zapier',           category: 'automation',  tier: 'professional' },
  { key: 'webhooks',        label: 'Webhooks',         category: 'automation',  tier: 'professional' },
  { key: 'salesforce',      label: 'Salesforce',       category: 'crm',         tier: 'enterprise' },
  { key: 'sap',             label: 'SAP ERP',          category: 'erp',         tier: 'enterprise' },
  { key: 'servicenow',      label: 'ServiceNow',       category: 'itsm',        tier: 'enterprise' },
  { key: 'paylocity',       label: 'Paylocity',        category: 'hr',          tier: 'enterprise' },
  { key: 'p21-erp',         label: 'P21 ERP (Epicor)', category: 'erp',         tier: 'enterprise' },
  { key: 'epic',            label: 'Epic EHR (FHIR)',  category: 'healthcare',  tier: 'enterprise' },
  { key: 'hl7-fhir',        label: 'HL7 FHIR Generic', category: 'healthcare',  tier: 'enterprise' },
  { key: 'bacnet-iot',      label: 'BACnet IoT',       category: 'iot',         tier: 'enterprise' },
  { key: 'teams',           label: 'Microsoft Teams',  category: 'communication', tier: 'professional' },
];

/* ── GET /api/v1/platform/integrations — List all available integrations ── */
router.get('/integrations', auth, requirePlatformOwner, async (req, res) => {
  res.json({ integrations: ALL_INTEGRATIONS, total: ALL_INTEGRATIONS.length });
});

/* ── GET /api/v1/platform/companies/:id/integrations — Get a company's enabled integrations ── */
router.get('/companies/:id/integrations', auth, requirePlatformOwner, async (req, res) => {
  try {
    if (!Company) return res.status(503).json({ msg: 'Company model not available' });

    const company = await Company.findById(req.params.id).select('name enabledIntegrations onboarding');
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    res.json({
      companyId: company._id,
      companyName: company.name,
      enabledIntegrations: company.enabledIntegrations || [],
      onboarding: company.onboarding || {},
      available: ALL_INTEGRATIONS,
    });
  } catch(err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/* ── PUT /api/v1/platform/companies/:id/integrations — Assign integrations to a company ── */
router.put('/companies/:id/integrations', auth, requirePlatformOwner, async (req, res) => {
  try {
    if (!Company) return res.status(503).json({ msg: 'Company model not available' });

    const { enabledIntegrations } = req.body;
    if (!Array.isArray(enabledIntegrations)) {
      return res.status(400).json({ msg: 'enabledIntegrations must be an array of integration keys' });
    }

    // Validate keys
    const validKeys = ALL_INTEGRATIONS.map(i => i.key);
    const invalid = enabledIntegrations.filter(k => !validKeys.includes(k));
    if (invalid.length > 0) {
      return res.status(400).json({ msg: `Invalid integration keys: ${invalid.join(', ')}` });
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { $set: { enabledIntegrations } },
      { new: true }
    );
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    await logPlatformAction('ASSIGN_INTEGRATIONS', null, {
      companyId: company._id, companyName: company.name,
      integrations: enabledIntegrations, count: enabledIntegrations.length,
    }, req);

    res.json({
      msg: `${enabledIntegrations.length} integrations assigned to ${company.name}`,
      companyId: company._id,
      enabledIntegrations: company.enabledIntegrations,
    });
  } catch(err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

/* ── PUT /api/v1/platform/companies/:id/onboarding — Update company onboarding status ── */
router.put('/companies/:id/onboarding', auth, requirePlatformOwner, async (req, res) => {
  try {
    if (!Company) return res.status(503).json({ msg: 'Company model not available' });

    const updates = {};
    const fields = ['companyInfo', 'dataImported', 'teamInvited', 'clientsAdded', 'inventorySetup', 'firstWO', 'tourCompleted'];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[`onboarding.${f}`] = req.body[f];
    }

    // Auto-set completedAt if all done
    if (fields.every(f => req.body[f] === true)) {
      updates['onboarding.completedAt'] = new Date();
    }

    const company = await Company.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    res.json({ msg: 'Onboarding updated', onboarding: company.onboarding });
  } catch(err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
