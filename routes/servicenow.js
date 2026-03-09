const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Company = require('../models/Company');

// Mock route for testing connection
router.get('/status/:companyId', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });
    
    res.json({ connected: !!company.integrations?.servicenow?.connected });
  } catch (err) {
    res.status(500).json({ error: 'Server error check status' });
  }
});

// Configure ServiceNow Mock Connection
router.post('/configure', auth, async (req, res) => {
  try {
    const { companyId, instanceUrl, clientId, clientSecret } = req.body;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    company.integrations = company.integrations || {};
    company.integrations.servicenow = {
      connected: true,
      instanceUrl,
      clientId,
      clientSecret
    };
    
    await company.save();
    res.json({ connected: true, msg: 'ServiceNow configured successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to configure ServiceNow' });
  }
});

// Disconnect ServiceNow
router.post('/disconnect', auth, async (req, res) => {
  try {
    const { companyId } = req.body;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    if (company.integrations && company.integrations.servicenow) {
      company.integrations.servicenow.connected = false;
      company.integrations.servicenow.instanceUrl = undefined;
      company.integrations.servicenow.clientId = undefined;
      company.integrations.servicenow.clientSecret = undefined;
      await company.save();
    }
    
    res.json({ connected: false, msg: 'ServiceNow disconnected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect ServiceNow' });
  }
});

module.exports = router;
