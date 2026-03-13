const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

/**
 * ═══════════════════════════════════════════════════════════════════
 * P21 (PROPHET 21 / EPICOR) ERP INTEGRATION
 * Technical Made Easy — Inventory & Purchase Order Connectivity
 *
 * Prophet 21 is the #1 ERP used by biomedical parts distributors.
 * This integration syncs:
 *   - Inventory / parts catalog → TME inventory
 *   - Purchase orders
 *   - Customer / vendor lists
 *   - Pricing (customer-specific)
 *
 * HIPAA: P21 contains only business inventory data, NOT PHI.
 * No patient or clinical data is stored in or synced with P21.
 *
 * Setup requires:
 *   - P21 REST API endpoint URL
 *   - API key (from Epicor admin)
 *   - Company code
 * ═══════════════════════════════════════════════════════════════════
 */

// Per-company config would be stored in Company model in production
const P21_CONFIGS = {};

// Demo inventory data for when backend has no real P21 connection
const DEMO_INVENTORY = [
  { itemId: 'P21-001', partNumber: 'CL-250', description: '2.5mm Catheter Lead', manufacturer: 'Medtronic', uom: 'EA', qtyOnHand: 42, qtyAvailable: 38, listPrice: 185.00, category: 'Medical Supplies', warehouse: 'Main', lastUpdated: '2026-03-10T08:00:00Z' },
  { itemId: 'P21-002', partNumber: 'PB-900', description: 'Power Board B-90', manufacturer: 'Philips', uom: 'EA', qtyOnHand: 12, qtyAvailable: 10, listPrice: 450.00, category: 'Electronics', warehouse: 'Main', lastUpdated: '2026-03-09T14:30:00Z' },
  { itemId: 'P21-003', partNumber: 'OR-SK', description: 'O-Ring Seal Kit', manufacturer: 'Various', uom: 'KIT', qtyOnHand: 120, qtyAvailable: 120, listPrice: 12.50, category: 'Mechanical', warehouse: 'Main', lastUpdated: '2026-03-11T09:00:00Z' },
  { itemId: 'P21-004', partNumber: 'LCD-22', description: 'LCD Display Panel', manufacturer: 'Advantech', uom: 'EA', qtyOnHand: 5, qtyAvailable: 3, listPrice: 890.00, category: 'Electronics', warehouse: 'Main', lastUpdated: '2026-03-08T16:00:00Z' },
  { itemId: 'P21-005', partNumber: 'PD-55', description: 'Pump Diaphragm', manufacturer: 'Baxter', uom: 'EA', qtyOnHand: 28, qtyAvailable: 28, listPrice: 65.00, category: 'Mechanical', warehouse: 'Main', lastUpdated: '2026-03-10T11:15:00Z' },
  { itemId: 'P21-006', partNumber: 'FOC-12', description: 'Fiber Optic Cable (12ft)', manufacturer: 'Stryker', uom: 'EA', qtyOnHand: 15, qtyAvailable: 12, listPrice: 320.00, category: 'Optical', warehouse: 'Main', lastUpdated: '2026-03-07T07:45:00Z' },
  { itemId: 'P21-007', partNumber: 'SP-02', description: 'SpO2 Sensor Probe (Reusable)', manufacturer: 'Nellcor', uom: 'EA', qtyOnHand: 35, qtyAvailable: 30, listPrice: 95.00, category: 'Medical Supplies', warehouse: 'Main', lastUpdated: '2026-03-11T12:00:00Z' },
  { itemId: 'P21-008', partNumber: 'ECG-LWS', description: 'ECG Lead Wire Set (5-Lead)', manufacturer: 'Philips', uom: 'SET', qtyOnHand: 2, qtyAvailable: 2, listPrice: 45.00, category: 'Medical Supplies', warehouse: 'Main', lastUpdated: '2026-03-06T15:30:00Z' },
  { itemId: 'P21-009', partNumber: 'DEF-PAD', description: 'Defibrillator Pads (Adult)', manufacturer: 'Zoll', uom: 'PAIR', qtyOnHand: 4, qtyAvailable: 4, listPrice: 125.00, category: 'Medical Supplies', warehouse: 'Main', lastUpdated: '2026-03-05T10:00:00Z' },
  { itemId: 'P21-010', partNumber: 'VF-100', description: 'Ventilator Filter (HEPA)', manufacturer: 'Draeger', uom: 'EA', qtyOnHand: 1, qtyAvailable: 1, listPrice: 38.00, category: 'Medical Supplies', warehouse: 'Main', lastUpdated: '2026-03-04T13:20:00Z' },
  { itemId: 'P21-011', partNumber: 'IPT-20', description: 'Infusion Pump Tubing Set', manufacturer: 'BD', uom: 'SET', qtyOnHand: 3, qtyAvailable: 3, listPrice: 22.00, category: 'Medical Supplies', warehouse: 'Main', lastUpdated: '2026-03-09T08:45:00Z' },
  { itemId: 'P21-012', partNumber: 'SG-100', description: 'Sterilizer Door Gasket', manufacturer: 'Steris', uom: 'EA', qtyOnHand: 20, qtyAvailable: 18, listPrice: 75.00, category: 'Mechanical', warehouse: 'Annex', lastUpdated: '2026-03-10T10:00:00Z' },
];

const DEMO_VENDORS = [
  { vendorId: 'V-001', name: 'Medline Industries', contact: 'orders@medline.com', phone: '(800) 633-5463', terms: 'Net 30' },
  { vendorId: 'V-002', name: 'McKesson Medical', contact: 'supply@mckesson.com', phone: '(800) 446-3002', terms: 'Net 30' },
  { vendorId: 'V-003', name: 'Henry Schein', contact: 'orders@henryschein.com', phone: '(800) 772-4346', terms: 'Net 45' },
  { vendorId: 'V-004', name: 'Cardinal Health', contact: 'sales@cardinalhealth.com', phone: '(800) 234-8701', terms: 'Net 30' },
  { vendorId: 'V-005', name: 'Stryker Direct', contact: 'service@stryker.com', phone: '(800) 253-3210', terms: 'Net 60' },
  { vendorId: 'V-006', name: 'Steris Parts & Service', contact: 'parts@steris.com', phone: '(800) 548-4873', terms: 'Net 30' },
];

// @route    GET api/v1/p21/status/:companyId
// @desc     Check P21 connection status for a company
router.get('/status/:companyId', auth, async (req, res) => {
  try {
    const config = P21_CONFIGS[req.params.companyId];
    res.json({
      connected: !!config,
      companyId: req.params.companyId,
      baseUrl: config?.baseUrl || null,
      message: config ? 'P21 ERP connected' : 'P21 not configured — using demo data',
    });
  } catch (err) {
    res.status(500).json({ msg: 'Error checking P21 status' });
  }
});

// @route    POST api/v1/p21/configure
// @desc     Save P21 API config for a company
router.post('/configure', auth, async (req, res) => {
  try {
    if (!['COMPANY', 'OWNER', 'ADMIN', 'PLATFORM_OWNER'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Admin only' });
    }

    const { companyId, p21BaseUrl, p21ApiKey, p21CompanyCode } = req.body;
    P21_CONFIGS[companyId || req.user.companyId] = {
      baseUrl: p21BaseUrl,
      apiKey: p21ApiKey,
      companyCode: p21CompanyCode,
      connectedAt: new Date().toISOString(),
    };

    await AuditLog.create({
      action: 'P21_CONFIGURE', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'integration', targetId: 'p21',
      details: `P21 configured — base URL: ${p21BaseUrl}`,
    });

    res.json({ success: true, message: 'P21 configured successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'P21 configuration failed', error: err.message });
  }
});

// @route    POST api/v1/p21/disconnect
// @desc     Disconnect P21 for a company
router.post('/disconnect', auth, async (req, res) => {
  try {
    const cid = req.body.companyId || req.user.companyId;
    delete P21_CONFIGS[cid];
    res.json({ success: true, message: 'P21 disconnected' });
  } catch (err) {
    res.status(500).json({ msg: 'P21 disconnect failed' });
  }
});

// @route    GET api/v1/p21/inventory/search
// @desc     Search P21 inventory by part number or description
router.get('/inventory/search', auth, async (req, res) => {
  try {
    const { query, companyId, category } = req.query;
    const config = P21_CONFIGS[companyId || req.user.companyId];

    if (config && config.apiKey) {
      // Live P21 API call
      try {
        const response = await fetch(`${config.baseUrl}/inventory/search?q=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Accept': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          return res.json({ mode: 'live', items: data.items || data });
        }
      } catch (apiErr) {
        console.error('P21 API error, falling back to demo:', apiErr.message);
      }
    }

    // Demo mode fallback
    let items = DEMO_INVENTORY;
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(i =>
        i.description.toLowerCase().includes(q) ||
        i.partNumber.toLowerCase().includes(q) ||
        i.manufacturer.toLowerCase().includes(q)
      );
    }
    if (category) {
      items = items.filter(i => i.category.toLowerCase() === category.toLowerCase());
    }

    res.json({ mode: 'demo', items, total: items.length });
  } catch (err) {
    res.status(500).json({ msg: 'P21 search failed', error: err.message });
  }
});

// @route    GET api/v1/p21/inventory/:itemId
// @desc     Get single item details from P21
router.get('/inventory/:itemId', auth, async (req, res) => {
  try {
    const item = DEMO_INVENTORY.find(i => i.itemId === req.params.itemId || i.partNumber === req.params.itemId);
    if (!item) return res.status(404).json({ msg: 'Item not found' });
    res.json({ mode: 'demo', item });
  } catch (err) {
    res.status(500).json({ msg: 'P21 item lookup failed' });
  }
});

// @route    POST api/v1/p21/inventory/bulk
// @desc     Bulk lookup items by part numbers
router.post('/inventory/bulk', auth, async (req, res) => {
  try {
    const { partNumbers } = req.body;
    if (!partNumbers || !Array.isArray(partNumbers)) {
      return res.status(400).json({ msg: 'partNumbers array required' });
    }
    const items = DEMO_INVENTORY.filter(i => partNumbers.includes(i.partNumber));
    res.json({ mode: 'demo', items, requested: partNumbers.length, found: items.length });
  } catch (err) {
    res.status(500).json({ msg: 'P21 bulk lookup failed' });
  }
});

// @route    POST api/v1/p21/inventory/sync
// @desc     Sync inventory between P21 and local TME
router.post('/inventory/sync', auth, async (req, res) => {
  try {
    const { companyId, direction } = req.body;

    await AuditLog.create({
      action: 'P21_INVENTORY_SYNC', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'integration', targetId: 'p21',
      details: `Inventory sync: ${direction} — ${DEMO_INVENTORY.length} items`,
    });

    res.json({
      mode: 'demo',
      direction: direction || 'p21_to_local',
      synced: DEMO_INVENTORY.length,
      items: DEMO_INVENTORY,
      message: 'Demo sync complete — connect P21 API key for live sync',
    });
  } catch (err) {
    res.status(500).json({ msg: 'P21 sync failed', error: err.message });
  }
});

// @route    GET api/v1/p21/pricing
// @desc     Get customer-specific pricing
router.get('/pricing', auth, async (req, res) => {
  try {
    const { itemId, customerId } = req.query;
    const item = DEMO_INVENTORY.find(i => i.itemId === itemId || i.partNumber === itemId);
    if (!item) return res.status(404).json({ msg: 'Item not found' });

    // Demo: 15% discount for "contract" customers
    const contractPrice = Math.round(item.listPrice * 0.85 * 100) / 100;
    res.json({
      mode: 'demo',
      itemId: item.itemId,
      partNumber: item.partNumber,
      listPrice: item.listPrice,
      contractPrice,
      customerId: customerId || 'demo-customer',
      priceBreaks: [
        { qty: 1, price: item.listPrice },
        { qty: 5, price: Math.round(item.listPrice * 0.95 * 100) / 100 },
        { qty: 10, price: Math.round(item.listPrice * 0.90 * 100) / 100 },
        { qty: 25, price: contractPrice },
      ],
    });
  } catch (err) {
    res.status(500).json({ msg: 'P21 pricing lookup failed' });
  }
});

// @route    POST api/v1/p21/purchase-orders
// @desc     Create a purchase order in P21
router.post('/purchase-orders', auth, async (req, res) => {
  try {
    const { vendorId, lineItems, notes, companyId } = req.body;
    const poNumber = `PO-P21-${Date.now().toString(36).toUpperCase()}`;

    await AuditLog.create({
      action: 'P21_PO_CREATE', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'purchaseOrder', targetId: poNumber,
      details: `P21 PO created: ${poNumber} — ${lineItems?.length || 0} line items`,
    });

    res.json({
      mode: 'demo',
      poNumber,
      vendorId: vendorId || 'V-001',
      status: 'submitted',
      lineItems: lineItems || [],
      notes: notes || '',
      createdAt: new Date().toISOString(),
      message: 'Demo PO created — connect P21 API for live PO submission',
    });
  } catch (err) {
    res.status(500).json({ msg: 'P21 PO creation failed', error: err.message });
  }
});

// @route    GET api/v1/p21/purchase-orders
// @desc     List open purchase orders
router.get('/purchase-orders', auth, async (req, res) => {
  try {
    res.json({
      mode: 'demo',
      purchaseOrders: [
        { poNumber: 'PO-P21-DEM001', vendorId: 'V-001', vendor: 'Medline Industries', status: 'open', lineItems: 3, total: 1250.00, createdAt: '2026-03-01T10:00:00Z', eta: '2026-03-15' },
        { poNumber: 'PO-P21-DEM002', vendorId: 'V-005', vendor: 'Stryker Direct', status: 'shipped', lineItems: 1, total: 890.00, createdAt: '2026-02-28T14:00:00Z', eta: '2026-03-12', trackingNumber: 'STK-998231' },
        { poNumber: 'PO-P21-DEM003', vendorId: 'V-006', vendor: 'Steris Parts & Service', status: 'received', lineItems: 5, total: 375.00, createdAt: '2026-02-20T09:00:00Z', receivedAt: '2026-03-05' },
      ],
    });
  } catch (err) {
    res.status(500).json({ msg: 'P21 PO list failed' });
  }
});

// @route    GET api/v1/p21/vendors
// @desc     Get vendor list from P21
router.get('/vendors', auth, async (req, res) => {
  try {
    res.json({ mode: 'demo', vendors: DEMO_VENDORS });
  } catch (err) {
    res.status(500).json({ msg: 'P21 vendor list failed' });
  }
});

// @route    GET api/v1/p21/customers
// @desc     Get customer list from P21
router.get('/customers', auth, async (req, res) => {
  try {
    res.json({
      mode: 'demo',
      customers: [
        { customerId: 'C-001', name: 'Riverside Medical Center', accountNumber: 'ACC-00421', terms: 'Net 30', priceTier: 'Contract A' },
        { customerId: 'C-002', name: 'Summit Clinic', accountNumber: 'ACC-00385', terms: 'Net 30', priceTier: 'Standard' },
        { customerId: 'C-003', name: "St. Luke's Medical Center", accountNumber: 'ACC-00601', terms: 'Net 45', priceTier: 'Contract B' },
        { customerId: 'C-004', name: 'Desert Regional Medical Center', accountNumber: 'ACC-00801', terms: 'Net 30', priceTier: 'Contract A' },
      ],
    });
  } catch (err) {
    res.status(500).json({ msg: 'P21 customer list failed' });
  }
});

module.exports = router;
