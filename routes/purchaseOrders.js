const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const PurchaseOrder = require('../models/PurchaseOrder');
const Inventory = require('../models/Inventory');
const Vendor = require('../models/Vendor');
const AuditLog = require('../models/AuditLog');

/**
 * ═══════════════════════════════════════════════════════════════════
 * PURCHASE ORDER ROUTES
 * Full PO workflow: draft → submit → approve → order → receive → close
 * On "receive" → auto-increment Inventory stock
 * ═══════════════════════════════════════════════════════════════════
 */

// @route    GET api/v1/purchase-orders
// @desc     Get all POs for a company
router.get('/', auth, async (req, res) => {
  try {
    const query = { companyId: req.user.companyId };
    if (req.query.status) query.status = req.query.status;
    if (req.query.vendorName) query.vendorName = new RegExp(req.query.vendorName, 'i');

    const pos = await PurchaseOrder.find(query).sort({ createdAt: -1 }).limit(200);
    res.json(pos);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/v1/purchase-orders/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ msg: 'PO not found' });
    res.json(po);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/purchase-orders
// @desc     Create a new PO (starts as draft)
router.post('/', auth, async (req, res) => {
  try {
    const poData = {
      ...req.body,
      companyId: req.user.companyId,
      poNumber: req.body.poNumber || `PO-${Date.now().toString(36).toUpperCase()}`,
      requestedBy: req.user.id,
      requestedByName: req.user.name,
      status: 'draft',
    };

    const po = await PurchaseOrder.create(poData);

    await AuditLog.create({
      action: 'PO_CREATED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'purchaseOrder',
      targetId: po._id.toString(),
      details: `PO ${po.poNumber} created for ${po.vendorName} — $${po.totalAmount}`,
    });

    res.status(201).json(po);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/v1/purchase-orders/:id
// @desc     Update a PO (draft or submitted only)
router.put('/:id', auth, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ msg: 'PO not found' });
    if (!['draft', 'submitted'].includes(po.status)) {
      return res.status(400).json({ msg: 'Can only edit draft or submitted POs' });
    }

    Object.assign(po, req.body);
    await po.save(); // Triggers pre-save total calculation
    res.json(po);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/v1/purchase-orders/:id/submit
// @desc     Submit PO for approval
router.put('/:id/submit', auth, async (req, res) => {
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id,
      { $set: { status: 'submitted' } }, { new: true });
    if (!po) return res.status(404).json({ msg: 'PO not found' });

    await AuditLog.create({
      action: 'PO_SUBMITTED', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'purchaseOrder', targetId: po._id.toString(),
      details: `PO ${po.poNumber} submitted for approval — $${po.totalAmount}`,
    });
    res.json(po);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/v1/purchase-orders/:id/approve
// @desc     Approve a submitted PO
router.put('/:id/approve', auth, async (req, res) => {
  try {
    if (!['COMPANY', 'OWNER', 'ADMIN', 'PLATFORM_OWNER'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Only admins can approve POs' });
    }
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      $set: {
        status: 'approved',
        approvedBy: req.user.id,
        approvedByName: req.user.name,
        approvedAt: new Date(),
      }
    }, { new: true });
    if (!po) return res.status(404).json({ msg: 'PO not found' });

    await AuditLog.create({
      action: 'PO_APPROVED', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'purchaseOrder', targetId: po._id.toString(),
      details: `PO ${po.poNumber} approved by ${req.user.name} — $${po.totalAmount}`,
    });
    res.json(po);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/v1/purchase-orders/:id/reject
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      $set: {
        status: 'rejected',
        rejectedBy: req.user.id,
        rejectionReason: req.body.reason || 'No reason provided',
      }
    }, { new: true });
    if (!po) return res.status(404).json({ msg: 'PO not found' });

    await AuditLog.create({
      action: 'PO_REJECTED', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'purchaseOrder', targetId: po._id.toString(),
      details: `PO ${po.poNumber} rejected: ${req.body.reason || 'N/A'}`,
    });
    res.json(po);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// RECEIVE — Auto-increment inventory stock on PO receive
// ═══════════════════════════════════════════════════════════════════
router.put('/:id/receive', auth, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ msg: 'PO not found' });
    if (!['approved', 'ordered', 'partial'].includes(po.status)) {
      return res.status(400).json({ msg: 'PO must be approved/ordered to receive' });
    }

    const receivedItems = req.body.items || []; // [{ inventoryId, receivedQty }]
    let allReceived = true;

    for (const received of receivedItems) {
      // Update PO line item received qty
      const lineItem = po.items.find(i =>
        i.inventoryId === received.inventoryId || i._id.toString() === received.lineItemId
      );
      if (lineItem) {
        lineItem.receivedQty = (lineItem.receivedQty || 0) + (received.receivedQty || received.quantity || 0);
        if (lineItem.receivedQty < lineItem.quantity) allReceived = false;
      }

      // Auto-increment inventory stock
      if (received.inventoryId) {
        await Inventory.findByIdAndUpdate(received.inventoryId, {
          $inc: { quantity: received.receivedQty || received.quantity || 0 },
        });
      }
    }

    po.status = allReceived ? 'received' : 'partial';
    po.actualDelivery = allReceived ? new Date() : po.actualDelivery;
    await po.save();

    // Update vendor performance
    if (po.vendorId && allReceived) {
      const daysToDeliver = po.expectedDelivery
        ? Math.ceil((Date.now() - new Date(po.expectedDelivery).getTime()) / (24*60*60*1000))
        : null;
      await Vendor.findByIdAndUpdate(po.vendorId, {
        $inc: { totalOrders: 1, totalSpent: po.totalAmount },
      });
    }

    await AuditLog.create({
      action: 'PO_RECEIVED', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'purchaseOrder', targetId: po._id.toString(),
      details: `PO ${po.poNumber} ${allReceived ? 'fully received' : 'partially received'} — stock updated`,
    });

    res.json({ success: true, po, allReceived });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/v1/purchase-orders/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const po = await PurchaseOrder.findByIdAndDelete(req.params.id);
    if (!po) return res.status(404).json({ msg: 'PO not found' });
    await AuditLog.create({
      action: 'PO_DELETED', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'purchaseOrder', targetId: req.params.id,
      details: `PO ${po.poNumber} deleted`,
    });
    res.json({ msg: 'PO deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
