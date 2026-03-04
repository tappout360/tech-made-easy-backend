const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Asset = require('../models/Asset');

// @route   GET /api/v1/assets
// @desc    Get assets with filtering and search
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const query = {};

    // Scope by company (non-OWNER users)
    if (req.user.role !== 'OWNER' && req.user.companyId) {
      query.companyId = req.user.companyId;
    }

    // Search by QR tag, serial, model, or manufacturer
    if (req.query.search) {
      const s = req.query.search.trim();
      query.$or = [
        { qrTag: { $regex: s, $options: 'i' } },
        { serialNumber: { $regex: s, $options: 'i' } },
        { model: { $regex: s, $options: 'i' } },
        { manufacturer: { $regex: s, $options: 'i' } },
        { cmNumber: { $regex: s, $options: 'i' } },
      ];
    }

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by client
    if (req.query.clientId) {
      query.clientId = req.query.clientId;
    }

    // Filter by department
    if (req.query.department) {
      query.department = { $regex: req.query.department, $options: 'i' };
    }

    const assets = await Asset.find(query)
      .sort({ updatedAt: -1 })
      .limit(parseInt(req.query.limit) || 500);

    res.json(assets);
  } catch (err) {
    console.error('Assets GET error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/v1/assets
// @desc    Create a new asset
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const asset = new Asset({
      ...req.body,
      companyId: req.body.companyId || req.user.companyId,
    });
    await asset.save();
    res.status(201).json(asset);
  } catch (err) {
    console.error('Asset create error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT /api/v1/assets/:id
// @desc    Update an asset
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!asset) return res.status(404).json({ msg: 'Asset not found' });
    res.json(asset);
  } catch (err) {
    console.error('Asset update error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/v1/assets/:id
// @desc    Delete an asset
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    if (!asset) return res.status(404).json({ msg: 'Asset not found' });
    res.json({ msg: 'Asset removed' });
  } catch (err) {
    console.error('Asset delete error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
