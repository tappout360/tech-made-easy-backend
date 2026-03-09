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

// @route   POST /api/v1/assets/bulk-import
// @desc    Bulk import assets from array (CSV parsed on frontend)
// @access  Private (COMPANY, ADMIN)
router.post('/bulk-import', auth, async (req, res) => {
  try {
    if (!['COMPANY', 'ADMIN', 'OWNER'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Not authorized for bulk import' });
    }
    const { assets } = req.body;
    if (!Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ msg: 'No assets provided' });
    }
    if (assets.length > 500) {
      return res.status(400).json({ msg: 'Maximum 500 assets per batch' });
    }

    const results = { created: 0, skipped: 0, errors: [] };
    for (const assetData of assets) {
      try {
        if (!assetData.qrTag || !assetData.model || !assetData.clientId) {
          results.errors.push(`Missing required fields for ${assetData.qrTag || 'unknown'}`);
          results.skipped++;
          continue;
        }
        // Skip duplicates
        const existing = await Asset.findOne({ qrTag: assetData.qrTag });
        if (existing) {
          results.skipped++;
          continue;
        }
        const asset = new Asset({
          ...assetData,
          companyId: assetData.companyId || req.user.companyId,
        });
        await asset.save();
        results.created++;
      } catch (e) {
        results.errors.push(`${assetData.qrTag}: ${e.message}`);
        results.skipped++;
      }
    }

    res.json({
      msg: `Imported ${results.created} assets, skipped ${results.skipped}`,
      ...results,
    });
  } catch (err) {
    console.error('Bulk import error:', err.message);
    res.status(500).json({ msg: 'Bulk import failed' });
  }
});

// @route   GET /api/v1/assets/hierarchy/:clientId
// @desc    Get asset hierarchy grouped by site > building > department > room
// @access  Private
router.get('/hierarchy/:clientId', auth, async (req, res) => {
  try {
    const assets = await Asset.find({ clientId: req.params.clientId });
    const tree = {};
    assets.forEach(a => {
      const site = a.site || 'Main';
      const bldg = a.building || 'Main Building';
      const dept = a.department || 'General';
      const room = a.room || 'Unassigned';
      if (!tree[site]) tree[site] = {};
      if (!tree[site][bldg]) tree[site][bldg] = {};
      if (!tree[site][bldg][dept]) tree[site][bldg][dept] = {};
      if (!tree[site][bldg][dept][room]) tree[site][bldg][dept][room] = [];
      tree[site][bldg][dept][room].push({
        id: a._id,
        qrTag: a.qrTag,
        model: a.model,
        manufacturer: a.manufacturer,
        serialNumber: a.serialNumber,
        status: a.status,
        criticality: a.criticality,
        pmDueDate: a.pmDueDate,
      });
    });
    res.json({ tree, totalAssets: assets.length });
  } catch (err) {
    console.error('Hierarchy error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/v1/assets/lifecycle/:id
// @desc    Get lifecycle cost analysis for an asset
// @access  Private
router.get('/lifecycle/:id', auth, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ msg: 'Asset not found' });

    const totalCost = (asset.acquisitionCost || 0) + (asset.totalLaborCost || 0) + (asset.totalPartsCost || 0) + (asset.totalTravelCost || 0);
    const ageYears = asset.installDate ? ((Date.now() - new Date(asset.installDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
    const remainingLife = Math.max(0, (asset.expectedLifeYears || 10) - ageYears);
    const annualCost = ageYears > 0 ? totalCost / ageYears : totalCost;

    res.json({
      asset,
      lifecycle: {
        acquisitionCost: asset.acquisitionCost || 0,
        totalLaborCost: asset.totalLaborCost || 0,
        totalPartsCost: asset.totalPartsCost || 0,
        totalTravelCost: asset.totalTravelCost || 0,
        totalCostOfOwnership: Math.round(totalCost * 100) / 100,
        ageYears: Math.round(ageYears * 10) / 10,
        remainingLifeYears: Math.round(remainingLife * 10) / 10,
        annualizedCost: Math.round(annualCost * 100) / 100,
        totalServices: asset.totalServiceCount || 0,
        replacementRecommended: remainingLife <= 1 || (asset.conditionRating && asset.conditionRating <= 3),
      },
    });
  } catch (err) {
    console.error('Lifecycle error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
