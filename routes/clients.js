const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Client = require('../models/Client');

// @route   GET /api/v1/clients
// @desc    Get clients with filtering and search
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const query = {};

    // Scope by company (non-OWNER users)
    if (req.user.role !== 'OWNER' && req.user.companyId) {
      query.companyId = req.user.companyId;
    }

    // Search by name, account number, email, or contact
    if (req.query.search) {
      const s = req.query.search.trim();
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { accountNumber: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { contactName: { $regex: s, $options: 'i' } },
      ];
    }

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    const clients = await Client.find(query)
      .sort({ name: 1 })
      .limit(parseInt(req.query.limit) || 500);

    res.json(clients);
  } catch (err) {
    console.error('Clients GET error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/v1/clients
// @desc    Create a new client
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const client = new Client({
      ...req.body,
      companyId: req.body.companyId || req.user.companyId,
    });
    await client.save();
    res.status(201).json(client);
  } catch (err) {
    console.error('Client create error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT /api/v1/clients/:id
// @desc    Update a client
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!client) return res.status(404).json({ msg: 'Client not found' });
    res.json(client);
  } catch (err) {
    console.error('Client update error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE /api/v1/clients/:id
// @desc    Delete a client
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ msg: 'Client not found' });
    res.json({ msg: 'Client removed' });
  } catch (err) {
    console.error('Client delete error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
