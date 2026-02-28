const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Company = require('../models/Company');
const AuditLog = require('../models/AuditLog');

// @route    GET api/v1/companies
// @desc     Get all companies (OWNER only) or current company
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'OWNER') {
      const companies = await Company.find().sort({ createdAt: -1 });
      return res.json(companies);
    }
    // Non-owners only see their own company
    const company = await Company.findOne({ _id: req.user.companyId });
    res.json(company ? [company] : []);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/v1/companies/:id
// @desc     Get single company
// @access   Private
router.get('/:id', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    // Only owners or members of this company can view
    if (req.user.role !== 'OWNER' && req.user.companyId !== company._id.toString()) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    res.json(company);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/companies
// @desc     Create a new company
// @access   Private (OWNER only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ msg: 'Only the platform owner can create companies' });
    }

    const company = new Company(req.body);
    await company.save();

    // Audit log
    await new AuditLog({
      action: 'COMPANY_CREATED',
      userId: req.user.id,
      companyId: company._id.toString(),
      targetType: 'company',
      targetId: company._id.toString(),
      details: `Company "${company.name}" created`
    }).save();

    res.status(201).json(company);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/v1/companies/:id
// @desc     Update company settings/branding
// @access   Private (OWNER or COMPANY role)
router.put('/:id', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    if (req.user.role !== 'OWNER' && req.user.companyId !== company._id.toString()) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const updated = await Company.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    // Audit log
    await new AuditLog({
      action: 'COMPANY_UPDATED',
      userId: req.user.id,
      companyId: company._id.toString(),
      targetType: 'company',
      targetId: company._id.toString(),
      details: `Company settings updated`
    }).save();

    res.json(updated);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
