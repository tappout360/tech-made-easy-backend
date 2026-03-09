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
  floor: { type: String },
  room: { type: String },
  location: { type: String },   // freeform "Bay 3, Rack A"
  clientId: { type: String, required: true },
  companyId: { type: String },
  warrantyEnd: { type: String },
  lastPM: { type: String },
  pmDueDate: { type: String },
  pmCycle: { type: String },    // monthly, quarterly, semi-annual, annual
  status: { type: String, default: 'operational' },

  // ── Asset Hierarchy ──
  parentAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },

  // ── Lifecycle Cost Tracking ──
  acquisitionCost: { type: Number, default: 0 },
  installDate: { type: Date },
  expectedLifeYears: { type: Number, default: 10 },
  disposalDate: { type: Date },
  totalLaborCost: { type: Number, default: 0 },
  totalPartsCost: { type: Number, default: 0 },
  totalTravelCost: { type: Number, default: 0 },
  totalServiceCount: { type: Number, default: 0 },
  lastServiceDate: { type: Date },

  // ── Classification ──
  criticality: { type: String, default: 'standard' },  // critical, high, standard, low
  conditionRating: { type: Number, default: 5 },       // 1-10
  fdaRecallFlag: { type: Boolean, default: false },
  fdaRecallId: { type: String },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
