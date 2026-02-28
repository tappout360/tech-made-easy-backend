const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  qrTag: { type: String, required: true, unique: true },
  serialNumber: { type: String },
  cmNumber: { type: String },
  model: { type: String, required: true },
  manufacturer: { type: String },
  department: { type: String },
  site: { type: String },
  building: { type: String },
  location: { type: String },
  clientId: { type: String, required: true },
  companyId: { type: String }, // Can derive from client, but good to store
  warrantyEnd: { type: String }, // ISO Date string
  lastPM: { type: String },
  pmDueDate: { type: String },
  pmCycle: { type: String }, // 'monthly', 'quarterly', 'semi-annual', 'annual'
  status: { type: String, default: 'operational' } // 'operational', 'needs-repair', 'out-of-service'
}, { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
