const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Client = require('../models/Client');

// @route    GET api/v1/clients
// @desc     Get all clients for a company
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'OWNER') {
      query.companyId = req.user.companyId;
    }
    const clients = await Client.find(query).sort({ name: 1 });
    res.json(clients);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
