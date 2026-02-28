const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Asset = require('../models/Asset');

// @route    GET api/v1/assets
// @desc     Get all assets for a company
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'OWNER') {
      query.companyId = req.user.companyId;
    }
    const assets = await Asset.find(query).sort({ model: 1 });
    res.json(assets);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
