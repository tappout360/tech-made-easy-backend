const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Company = require('../models/Company');

// Mock route for testing connection
router.get('/status/:companyId', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });
    
    res.json({ connected: !!company.integrations?.sap?.connected });
  } catch (err) {
    res.status(500).json({ error: 'Server error check status' });
  }
});

// Configure SAP Mock Connection
router.post('/configure', auth, async (req, res) => {
  try {
    const { companyId, hostUrl, apiKey, clientCode } = req.body;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    company.integrations = company.integrations || {};
    company.integrations.sap = {
      connected: true,
      hostUrl,
      apiKey,
      clientCode
    };
    
    await company.save();
    res.json({ connected: true, msg: 'SAP configured successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to configure SAP' });
  }
});

// Disconnect SAP
router.post('/disconnect', auth, async (req, res) => {
  try {
    const { companyId } = req.body;
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ msg: 'Company not found' });

    if (company.integrations && company.integrations.sap) {
      company.integrations.sap.connected = false;
      company.integrations.sap.hostUrl = undefined;
      company.integrations.sap.apiKey = undefined;
      company.integrations.sap.clientCode = undefined;
      await company.save();
    }
    
    res.json({ connected: false, msg: 'SAP disconnected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect SAP' });
  }
});

module.exports = router;
