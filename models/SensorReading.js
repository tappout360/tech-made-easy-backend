const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  assetId: { type: String, required: true, index: true },
  companyId: { type: String, required: true, index: true },
  sensorType: { type: String, required: true }, // temperature, humidity, vibration, pressure, voltage, runtime_hours
  value: { type: Number, required: true },
  unit: { type: String }, // °C, °F, %RH, mm/s, PSI, V, hrs
  status: { type: String, default: 'normal' }, // normal, warning, critical
  sensorId: { type: String }, // Physical sensor identifier
  metadata: { type: mongoose.Schema.Types.Mixed }, // Extra sensor data
  timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: false });

// Compound index for fast asset+time queries
sensorReadingSchema.index({ assetId: 1, timestamp: -1 });
sensorReadingSchema.index({ assetId: 1, sensorType: 1, timestamp: -1 });

// TTL: auto-delete raw readings older than 1 year (365 days)
sensorReadingSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
