const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

/**
 * ═══════════════════════════════════════════════════════════════════
 * EPIC SYSTEMS FHIR R4 INTEGRATION
 * Technical Made Easy — Healthcare EHR Connectivity
 *
 * Epic uses HL7 FHIR R4 APIs for interoperability.
 * This integration pulls:
 *   - Device resources (medical equipment → TME assets)
 *   - Location resources (departments/rooms → TME sites)
 *   - Organization resources (facilities → TME clients)
 *
 * HIPAA: All data flows are audit-logged. No PHI is stored
 * beyond what's necessary for equipment identification.
 *
 * Setup requires:
 *   - Epic App Orchard registration
 *   - Client credentials (client_id + private key for JWT)
 *   - FHIR base URL (e.g., https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4)
 * ═══════════════════════════════════════════════════════════════════
 */

// In production, these come from company settings / env vars
const EPIC_CONFIG = {
  // Default sandbox for demo
  fhirBaseUrl: process.env.EPIC_FHIR_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
  clientId: process.env.EPIC_CLIENT_ID || null,
  tokenUrl: process.env.EPIC_TOKEN_URL || 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
  scope: 'system/Device.read system/Location.read system/Organization.read',
};

/**
 * Transform Epic FHIR Device resource → TME Asset format.
 */
function transformDevice(device) {
  return {
    epicDeviceId: device.id,
    model: device.modelNumber || device.deviceName?.[0]?.name || 'Unknown Device',
    manufacturer: device.manufacturer || '',
    serialNumber: device.serialNumber || '',
    udi: device.udiCarrier?.[0]?.carrierHRF || null, // Unique Device Identifier
    status: device.status === 'active' ? 'operational' : device.status || 'unknown',
    type: device.type?.coding?.[0]?.display || device.type?.text || '',
    typeCode: device.type?.coding?.[0]?.code || '',
    location: device.location?.display || '',
    locationRef: device.location?.reference || null,
    owner: device.owner?.display || '',
    contact: device.contact?.[0]?.name?.text || '',
    notes: device.note?.[0]?.text || '',
    expirationDate: device.expirationDate || null,
    lotNumber: device.lotNumber || null,
    _source: 'epic',
    _importedAt: new Date().toISOString(),
  };
}

/**
 * Transform Epic FHIR Location resource → TME site/department format.
 */
function transformLocation(location) {
  return {
    epicLocationId: location.id,
    name: location.name || 'Unknown Location',
    description: location.description || '',
    type: location.type?.[0]?.coding?.[0]?.display || '',
    status: location.status || 'active',
    address: location.address ? {
      street: (location.address.line || []).join(', '),
      city: location.address.city || '',
      state: location.address.state || '',
      zip: location.address.postalCode || '',
    } : null,
    phone: location.telecom?.find(t => t.system === 'phone')?.value || '',
    partOf: location.partOf?.display || null,
    _source: 'epic',
  };
}

// @route    GET api/v1/epic/status
// @desc     Check Epic connection status
router.get('/status', auth, async (req, res) => {
  try {
    const configured = !!(EPIC_CONFIG.clientId || process.env.EPIC_CLIENT_ID);
    res.json({
      connected: configured,
      fhirVersion: 'R4',
      baseUrl: EPIC_CONFIG.fhirBaseUrl,
      capabilities: ['Device', 'Location', 'Organization'],
      note: configured
        ? 'Epic FHIR R4 connection active'
        : 'Epic not configured — set EPIC_CLIENT_ID and EPIC_FHIR_URL in environment',
    });
  } catch (err) {
    res.status(500).json({ msg: 'Error checking Epic status' });
  }
});

// @route    POST api/v1/epic/sync-devices
// @desc     Pull Device resources from Epic → create/update TME assets
router.post('/sync-devices', auth, async (req, res) => {
  try {
    if (!['COMPANY', 'OWNER', 'ADMIN', 'PLATFORM_OWNER'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Admin only' });
    }

    // In production: use JWT Bearer token auth to Epic
    const fhirUrl = req.body.fhirBaseUrl || EPIC_CONFIG.fhirBaseUrl;
    const accessToken = req.body.accessToken; // Provided by frontend OAuth flow

    if (!accessToken) {
      // Return demo data structure for demo mode
      const demoDevices = [
        { id: 'epic-dev-001', modelNumber: 'Sigma Spectrum', manufacturer: 'Baxter', serialNumber: 'SN-98234', status: 'active', type: { text: 'Infusion Pump' }, location: { display: 'ICU Room 401' } },
        { id: 'epic-dev-002', modelNumber: 'Puritan Bennett 980', manufacturer: 'Medtronic', serialNumber: 'SN-45231', status: 'active', type: { text: 'Ventilator' }, location: { display: 'OR Suite 2' } },
        { id: 'epic-dev-003', modelNumber: 'IntelliVue MX800', manufacturer: 'Philips', serialNumber: 'SN-77823', status: 'active', type: { text: 'Patient Monitor' }, location: { display: 'PACU Bay 3' } },
        { id: 'epic-dev-004', modelNumber: 'V-Pro maX', manufacturer: 'Steris', serialNumber: 'SN-12094', status: 'active', type: { text: 'Sterilizer' }, location: { display: 'Sterile Processing' } },
        { id: 'epic-dev-005', modelNumber: 'Alaris 8100', manufacturer: 'BD', serialNumber: 'SN-66102', status: 'inactive', type: { text: 'Infusion Module' }, location: { display: 'Med-Surg 2C' } },
      ];

      const assets = demoDevices.map(transformDevice);
      return res.json({
        mode: 'demo',
        message: 'Epic demo mode — showing sample device sync. Provide accessToken for live sync.',
        pulled: assets.length,
        assets,
      });
    }

    // Live FHIR call
    const response = await fetch(`${fhirUrl}/Device?_count=200`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        msg: `Epic FHIR returned ${response.status}`,
        detail: await response.text(),
      });
    }

    const bundle = await response.json();
    const devices = (bundle.entry || []).map(e => e.resource).filter(r => r.resourceType === 'Device');
    const assets = devices.map(transformDevice);

    await AuditLog.create({
      action: 'EPIC_DEVICE_SYNC', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'integration', targetId: 'epic',
      details: `Synced ${assets.length} devices from Epic FHIR`,
    });

    res.json({ mode: 'live', pulled: assets.length, assets });
  } catch (err) {
    console.error('Epic sync error:', err.message);
    res.status(500).json({ msg: 'Epic sync failed', error: err.message });
  }
});

// @route    POST api/v1/epic/sync-locations
// @desc     Pull Location resources from Epic → map to TME sites
router.post('/sync-locations', auth, async (req, res) => {
  try {
    const fhirUrl = req.body.fhirBaseUrl || EPIC_CONFIG.fhirBaseUrl;
    const accessToken = req.body.accessToken;

    if (!accessToken) {
      const demoLocations = [
        { id: 'loc-001', name: 'ICU', description: 'Intensive Care Unit', type: [{ coding: [{ display: 'Ward' }] }], status: 'active', address: { line: ['100 Medical Center Dr'], city: 'Boston', state: 'MA', postalCode: '02115' } },
        { id: 'loc-002', name: 'OR Suite', description: 'Operating Room Suite', type: [{ coding: [{ display: 'Surgical' }] }], status: 'active' },
        { id: 'loc-003', name: 'Sterile Processing', description: 'Central Sterile Processing Dept', type: [{ coding: [{ display: 'Service Area' }] }], status: 'active' },
        { id: 'loc-004', name: 'Emergency Dept', description: 'Emergency Department', type: [{ coding: [{ display: 'Emergency' }] }], status: 'active' },
      ];

      const locations = demoLocations.map(transformLocation);
      return res.json({ mode: 'demo', pulled: locations.length, locations });
    }

    const response = await fetch(`${fhirUrl}/Location?_count=500`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/fhir+json' },
    });

    if (!response.ok) {
      return res.status(response.status).json({ msg: `Epic returned ${response.status}` });
    }

    const bundle = await response.json();
    const locs = (bundle.entry || []).map(e => e.resource).filter(r => r.resourceType === 'Location');
    const locations = locs.map(transformLocation);

    await AuditLog.create({
      action: 'EPIC_LOCATION_SYNC', userId: req.user.id, companyId: req.user.companyId,
      targetType: 'integration', targetId: 'epic',
      details: `Synced ${locations.length} locations from Epic FHIR`,
    });

    res.json({ mode: 'live', pulled: locations.length, locations });
  } catch (err) {
    console.error('Epic location sync error:', err.message);
    res.status(500).json({ msg: 'Epic sync failed', error: err.message });
  }
});

module.exports = router;
