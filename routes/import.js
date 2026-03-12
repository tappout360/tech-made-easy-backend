const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const WorkOrder = require('../models/WorkOrder');
const Asset = require('../models/Asset');
const Inventory = require('../models/Inventory');
const AuditLog = require('../models/AuditLog');

/**
 * ═══════════════════════════════════════════════════════════════════
 * BULK IMPORT API — Persist migration data to MongoDB
 * Technical Made Easy
 *
 * Accepts arrays of normalized records from the frontend
 * migration tool and creates them in batch.
 *
 * HIPAA: All imports are audit-logged with source tracking.
 * ═══════════════════════════════════════════════════════════════════
 */

// @route    POST api/v1/import/work-orders
router.post('/work-orders', auth, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ msg: 'No records provided' });
    }
    if (records.length > 5000) {
      return res.status(400).json({ msg: 'Maximum 5000 records per import' });
    }

    const woRecords = records.map(r => ({
      ...r,
      companyId: req.user.companyId,
      _imported: true,
      _importedAt: new Date(),
      _importedBy: req.user.id,
    }));

    const result = await WorkOrder.insertMany(woRecords, { ordered: false });

    await AuditLog.create({
      action: 'BULK_IMPORT_WO', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'workOrder', targetId: 'bulk',
      details: `Imported ${result.length} work orders from migration`,
    });

    res.json({ success: true, imported: result.length, total: records.length });
  } catch (err) {
    console.error('WO import error:', err.message);
    const inserted = err.insertedDocs?.length || 0;
    res.status(207).json({ success: false, imported: inserted, errors: err.writeErrors?.length || 0, msg: err.message });
  }
});

// @route    POST api/v1/import/clients
router.post('/clients', auth, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ msg: 'No records provided' });
    }

    // Dynamic import of Client model
    const Client = require('../models/Client');
    const clientRecords = records.map(r => ({
      ...r,
      companyId: req.user.companyId,
      _imported: true,
      _importedAt: new Date(),
    }));

    const result = await Client.insertMany(clientRecords, { ordered: false });

    await AuditLog.create({
      action: 'BULK_IMPORT_CLIENT', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'client', targetId: 'bulk',
      details: `Imported ${result.length} clients from migration`,
    });

    res.json({ success: true, imported: result.length, total: records.length });
  } catch (err) {
    console.error('Client import error:', err.message);
    res.status(207).json({ success: false, imported: err.insertedDocs?.length || 0, msg: err.message });
  }
});

// @route    POST api/v1/import/assets
router.post('/assets', auth, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ msg: 'No records provided' });
    }

    const assetRecords = records.map(r => ({
      ...r,
      companyId: req.user.companyId,
      qrTag: r.qrTag || `IMP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      _imported: true,
      _importedAt: new Date(),
    }));

    const result = await Asset.insertMany(assetRecords, { ordered: false });

    await AuditLog.create({
      action: 'BULK_IMPORT_ASSET', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'asset', targetId: 'bulk',
      details: `Imported ${result.length} assets from migration`,
    });

    res.json({ success: true, imported: result.length, total: records.length });
  } catch (err) {
    console.error('Asset import error:', err.message);
    res.status(207).json({ success: false, imported: err.insertedDocs?.length || 0, msg: err.message });
  }
});

// @route    POST api/v1/import/inventory
router.post('/inventory', auth, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ msg: 'No records provided' });
    }

    const invRecords = records.map(r => ({
      ...r,
      companyId: req.user.companyId,
      _imported: true,
      _importedAt: new Date(),
    }));

    const result = await Inventory.insertMany(invRecords, { ordered: false });

    await AuditLog.create({
      action: 'BULK_IMPORT_INV', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'inventory', targetId: 'bulk',
      details: `Imported ${result.length} inventory items from migration`,
    });

    res.json({ success: true, imported: result.length, total: records.length });
  } catch (err) {
    console.error('Inventory import error:', err.message);
    res.status(207).json({ success: false, imported: err.insertedDocs?.length || 0, msg: err.message });
  }
});

module.exports = router;
