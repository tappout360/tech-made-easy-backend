const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Vendor = require('../models/Vendor');
const AuditLog = require('../models/AuditLog');

/**
 * ═══════════════════════════════════════════════════════════════════
 * VENDOR ROUTES — Supplier/Vendor Contact Management
 * ═══════════════════════════════════════════════════════════════════
 */

// @route    GET api/v1/vendors
router.get('/', auth, async (req, res) => {
  try {
    const query = { companyId: req.user.companyId };
    if (req.query.active !== undefined) query.active = req.query.active === 'true';
    if (req.query.preferred) query.preferredVendor = true;
    if (req.query.category) query.categories = req.query.category;

    const vendors = await Vendor.find(query).sort({ preferredVendor: -1, name: 1 });
    res.json(vendors);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/vendors
router.post('/', auth, async (req, res) => {
  try {
    const vendor = await Vendor.create({ ...req.body, companyId: req.user.companyId });
    await AuditLog.create({
      action: 'VENDOR_CREATED', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'vendor', targetId: vendor._id.toString(),
      details: `Vendor "${vendor.name}" added`,
    });
    res.status(201).json(vendor);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/v1/vendors/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!vendor) return res.status(404).json({ msg: 'Vendor not found' });
    res.json(vendor);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/v1/vendors/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return res.status(404).json({ msg: 'Vendor not found' });
    res.json({ msg: 'Vendor deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
