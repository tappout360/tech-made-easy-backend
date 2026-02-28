const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const SensorReading = require('../models/SensorReading');
const AuditLog = require('../models/AuditLog');

// @route    GET api/v1/sensors/:assetId
// @desc     Get sensor readings for an asset
// @access   Private
router.get('/:assetId', auth, async (req, res) => {
  try {
    const query = {
      assetId: req.params.assetId,
      companyId: req.user.companyId
    };

    // Filter by sensor type
    if (req.query.type) query.sensorType = req.query.type;

    // Time range (default: last 24 hours)
    const from = req.query.from
      ? new Date(req.query.from)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    query.timestamp = { $gte: from, $lte: to };

    const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
    const readings = await SensorReading.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);

    res.json(readings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/v1/sensors/alerts/:companyId
// @desc     Get all critical/warning sensor alerts for a company
// @access   Private
router.get('/alerts/:companyId', auth, async (req, res) => {
  try {
    if (req.user.companyId !== req.params.companyId && req.user.role !== 'OWNER') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const alerts = await SensorReading.find({
      companyId: req.params.companyId,
      status: { $in: ['warning', 'critical'] },
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    }).sort({ timestamp: -1 }).limit(100);

    res.json(alerts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/sensors
// @desc     Submit sensor reading(s) — called by IoT devices or MQTT bridge
// @access   Private (or API key based for IoT devices)
router.post('/', auth, async (req, res) => {
  try {
    const readings = Array.isArray(req.body) ? req.body : [req.body];
    const toInsert = readings.map(r => ({
      ...r,
      companyId: r.companyId || req.user.companyId,
      status: evaluateStatus(r.sensorType, r.value)
    }));

    const created = await SensorReading.insertMany(toInsert);

    // Check for critical readings and auto-create audit entries
    const criticals = created.filter(r => r.status === 'critical');
    if (criticals.length > 0) {
      for (const c of criticals) {
        await new AuditLog({
          action: 'SENSOR_CRITICAL_ALERT',
          userId: 'SYSTEM',
          companyId: c.companyId,
          targetType: 'asset',
          targetId: c.assetId,
          details: `CRITICAL: ${c.sensorType} reading of ${c.value}${c.unit || ''} on asset ${c.assetId}`,
          metadata: { sensorType: c.sensorType, value: c.value, unit: c.unit }
        }).save();
      }
    }

    res.status(201).json({ inserted: created.length, criticals: criticals.length });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ── Threshold engine for sensor status evaluation ──
function evaluateStatus(sensorType, value) {
  const thresholds = {
    temperature: { warning: 35, critical: 45 },      // °C
    humidity: { warning: 70, critical: 85 },           // %RH
    vibration: { warning: 0.5, critical: 0.8 },        // mm/s (ips)
    pressure: { warning: 90, critical: 120 },          // PSI
    voltage: { warning: 250, critical: 280 },          // V
    runtime_hours: { warning: 8000, critical: 10000 }, // Hours
  };

  const t = thresholds[sensorType];
  if (!t) return 'normal';
  if (value >= t.critical) return 'critical';
  if (value >= t.warning) return 'warning';
  return 'normal';
}

module.exports = router;
