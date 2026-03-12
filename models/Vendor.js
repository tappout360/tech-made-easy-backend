const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════
 * VENDOR MODEL
 * Technical Made Easy — Vendor/Supplier Contact Management
 *
 * Tracks preferred vendors, lead times, payment terms, and
 * categories for procurement optimization.
 * ═══════════════════════════════════════════════════════════════════
 */

const vendorSchema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  contactName: { type: String },
  email: { type: String },
  phone: { type: String },
  website: { type: String },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    country: { type: String, default: 'US' },
  },

  // ── Account & Terms ──
  accountNumber: { type: String },
  paymentTerms: { type: String, default: 'Net 30' },  // Net 30, Net 60, COD, Prepaid
  taxExempt: { type: Boolean, default: false },
  taxId: { type: String },

  // ── Categories ──
  categories: [{ type: String }],  // ['Parts', 'Calibration', 'Service', 'Supplies', 'OEM']

  // ── Performance ──
  rating: { type: Number, default: 3, min: 1, max: 5 },
  avgLeadTimeDays: { type: Number, default: null },
  onTimeDeliveryRate: { type: Number, default: null },  // 0-100%
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },

  // ── Status ──
  preferredVendor: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  notes: { type: String, default: '' },

  // ── Certifications (for compliance) ──
  certifications: [{ type: String }],  // ['ISO 13485', 'FDA Registered', 'ISO 9001']
}, { timestamps: true });

vendorSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
