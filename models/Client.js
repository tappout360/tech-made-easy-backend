const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  accountNumber: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  contactName: { type: String },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  sites: [{ type: String }],
  companyId: { type: String, required: true },
  userId: { type: String, required: true },
  status: { type: String, default: 'active' },
  rating: { type: Number, default: 0 },
  portalSettings: {
    displayName: String,
    tagline: String,
    logo: String,
    logoUrl: String,
    accentColor: String,
    secondaryColor: String,
    auraColor: String,
    auraStyle: String,
    gradientFrom: String,
    gradientTo: String,
    headerStyle: String,
    headerBg: String,
    fontFamily: String,
    emailLink: String,
    websiteLink: String,
    supportPhone: String,
    socialLinks: {
      linkedin: String,
      twitter: String,
      facebook: String
    },
    features: {
      createWO: Boolean,
      viewWOs: Boolean,
      messages: Boolean,
      calendar: Boolean,
      archive: Boolean,
      billing: Boolean,
      assets: Boolean
    }
  },
  // ── Contracts & SLA ──
  contracts: [{
    contractNumber: String,
    type: { type: String, default: 'PM' },  // PM, Full-Service, Parts-Only, T&M
    startDate: Date,
    endDate: Date,
    billingRate: { type: Number, default: 85 },
    monthlyFee: { type: Number, default: 0 },
    coveredEquipment: [String],  // Asset IDs covered
    autoRenew: { type: Boolean, default: true },
    status: { type: String, default: 'active' },  // active, expired, pending
    notes: String,
  }],
  slaPolicy: {
    criticalResponse: { type: Number, default: 2 },    // hours
    criticalResolution: { type: Number, default: 8 },
    highResponse: { type: Number, default: 4 },
    highResolution: { type: Number, default: 24 },
    normalResponse: { type: Number, default: 8 },
    normalResolution: { type: Number, default: 72 },
    lowResponse: { type: Number, default: 24 },
    lowResolution: { type: Number, default: 168 },
  },
  coveredAssetCount: { type: Number, default: 0 },
  healthScore: { type: Number, default: 100 },  // 0-100 client health
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
