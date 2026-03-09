const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Company = require('../models/Company');

// Mock route for testing connection
router.get('/status/:companyId', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });
    
    res.json({ connected: !!company.integrations?.salesforce?.connected });
  } catch (err) {
    res.status(500).json({ error: 'Server error check status' });
  }
});

// Configure Salesforce Mock Connection
router.post('/configure', auth, async (req, res) => {
  try {
    const { companyId, instanceUrl, accessToken, refreshToken } = req.body;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    company.integrations = company.integrations || {};
    company.integrations.salesforce = {
      connected: true,
      instanceUrl,
      accessToken,
      refreshToken
    };
    
    await company.save();
    res.json({ connected: true, msg: 'Salesforce configured successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to configure Salesforce' });
  }
});

// Disconnect Salesforce
router.post('/disconnect', auth, async (req, res) => {
  try {
    const { companyId } = req.body;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    if (company.integrations && company.integrations.salesforce) {
      company.integrations.salesforce.connected = false;
      company.integrations.salesforce.instanceUrl = undefined;
      company.integrations.salesforce.accessToken = undefined;
      company.integrations.salesforce.refreshToken = undefined;
      await company.save();
    }
    
    res.json({ connected: false, msg: 'Salesforce disconnected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect Salesforce' });
  }
});

module.exports = router;
