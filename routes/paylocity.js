const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Company = require('../models/Company');

// Mock route for testing connection
router.get('/status/:companyId', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });
    
    res.json({ connected: !!company.integrations?.paylocity?.connected });
  } catch (err) {
    res.status(500).json({ error: 'Server error check status' });
  }
});

// Configure Paylocity Mock Connection
router.post('/configure', auth, async (req, res) => {
  try {
    const { companyId, clientId, clientSecret, paylocityCompanyId } = req.body;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    company.integrations = company.integrations || {};
    company.integrations.paylocity = {
      connected: true,
      clientId,
      clientSecret,
      companyId: paylocityCompanyId
    };
    
    await company.save();
    res.json({ connected: true, msg: 'Paylocity configured successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to configure Paylocity' });
  }
});

// Disconnect Paylocity
router.post('/disconnect', auth, async (req, res) => {
  try {
    const { companyId } = req.body;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    if (company.integrations && company.integrations.paylocity) {
      company.integrations.paylocity.connected = false;
      company.integrations.paylocity.clientId = undefined;
      company.integrations.paylocity.clientSecret = undefined;
      company.integrations.paylocity.companyId = undefined;
      await company.save();
    }
    
    res.json({ connected: false, msg: 'Paylocity disconnected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect Paylocity' });
  }
});

module.exports = router;
