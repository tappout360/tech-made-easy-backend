const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const WorkOrder = require('../models/WorkOrder');

// @route    GET api/v1/work-orders
// @desc     Get all work orders for a company
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    // In production, we filter by req.user.companyId unless OWNER
    let query = {};
    if (req.user.role !== 'OWNER') {
      query.companyId = req.user.companyId;
    }
    const wos = await WorkOrder.find(query).sort({ createdAt: -1 });
    res.json(wos);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/work-orders
// @desc     Create or update a work order
// @access   Private
router.post('/', auth, async (req, res) => {
  try {
    // Find by ID and update, or insert if not exists
    const wo = await WorkOrder.findOneAndUpdate(
      { id: req.body.id || 'new' }, // mockData approach uses string 'id'
      { $set: req.body },
      { new: true, upsert: true }
    );
    res.json(wo);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/v1/work-orders/:id
// @desc     Delete a work order
// @access   Private
router.delete('/:id', auth, async (req, res) => {
  try {
    await WorkOrder.findOneAndRemove({ id: req.params.id });
    res.json({ msg: 'Work order deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
