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
  }
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
