const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Inventory = require('../models/Inventory');
const AuditLog = require('../models/AuditLog');

// @route    GET api/v1/inventory
// @desc     Get all inventory items for a company
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    const query = { companyId: req.user.companyId };

    // Optional filters
    if (req.query.category) query.category = req.query.category;
    if (req.query.lowStock === 'true') {
      query.$expr = { $lte: ['$quantity', '$minQuantity'] };
    }
    if (req.query.search) {
      const s = req.query.search;
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { sku: { $regex: s, $options: 'i' } },
        { manufacturer: { $regex: s, $options: 'i' } }
      ];
    }
    // Van stock filter
    if (req.query.vanTechId) query.vanTechId = req.query.vanTechId;

    const items = await Inventory.find(query).sort({ name: 1 });
    res.json(items);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/inventory
// @desc     Add inventory item(s)
// @access   Private
router.post('/', auth, async (req, res) => {
  try {
    // Support bulk import: body can be array or single object
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const toInsert = items.map(item => ({
      ...item,
      companyId: req.user.companyId
    }));

    const created = await Inventory.insertMany(toInsert);

    await new AuditLog({
      action: 'INVENTORY_ADDED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'inventory',
      details: `${created.length} item(s) added to inventory`
    }).save();

    res.status(201).json(created);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/v1/inventory/:id
// @desc     Update inventory item
// @access   Private
router.put('/:id', auth, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Item not found' });
    if (item.companyId !== req.user.companyId && req.user.role !== 'OWNER') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const updated = await Inventory.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/inventory/:id/deduct
// @desc     Deduct stock (when parts used on WO)
// @access   Private
router.post('/:id/deduct', auth, async (req, res) => {
  try {
    const { quantity, woNumber, reason } = req.body;
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Item not found' });

    if (item.quantity < quantity) {
      return res.status(400).json({ msg: 'Insufficient stock', available: item.quantity });
    }

    item.quantity -= quantity;
    await item.save();

    await new AuditLog({
      action: 'INVENTORY_DEDUCTED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'inventory',
      targetId: item._id.toString(),
      details: `Deducted ${quantity}x "${item.name}" (SKU: ${item.sku})${woNumber ? ` for WO ${woNumber}` : ''}. Remaining: ${item.quantity}`,
      metadata: { woNumber, reason, previousQty: item.quantity + quantity, newQty: item.quantity }
    }).save();

    res.json(item);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/inventory/:id/restock
// @desc     Restock inventory item
// @access   Private
router.post('/:id/restock', auth, async (req, res) => {
  try {
    const { quantity, vendor, poNumber } = req.body;
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Item not found' });

    item.quantity += quantity;
    await item.save();

    await new AuditLog({
      action: 'INVENTORY_RESTOCKED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'inventory',
      targetId: item._id.toString(),
      details: `Restocked ${quantity}x "${item.name}" (SKU: ${item.sku}). New total: ${item.quantity}`,
      metadata: { vendor, poNumber, previousQty: item.quantity - quantity, newQty: item.quantity }
    }).save();

    res.json(item);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/v1/inventory/:id
// @desc     Delete inventory item
// @access   Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Item not found' });
    if (item.companyId !== req.user.companyId && req.user.role !== 'OWNER') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    await Inventory.findByIdAndDelete(req.params.id);

    await new AuditLog({
      action: 'INVENTORY_DELETED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'inventory',
      targetId: item._id.toString(),
      details: `Deleted "${item.name}" (SKU: ${item.sku}) from inventory`
    }).save();

    res.json({ msg: 'Item removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
