const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════
 * PURCHASE ORDER MODEL
 * Technical Made Easy — Full PO Workflow with Approval Chain
 *
 * Status Flow: draft → submitted → approved → ordered → partial → received → closed
 * On "received" → auto-increment Inventory stock quantities.
 * ═══════════════════════════════════════════════════════════════════
 */

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true },

  // ── Vendor ──
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
  vendorName: { type: String, required: true },
  vendorEmail: { type: String },
  vendorPhone: { type: String },
  vendorAccountNumber: { type: String },

  // ── Line Items ──
  items: [{
    inventoryId: { type: String, default: null },  // Links to Inventory model
    partName: { type: String, required: true },
    sku: { type: String },
    description: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    receivedQty: { type: Number, default: 0 },       // For partial receives
    lineTotal: { type: Number, default: 0 },
  }],

  // ── Financials ──
  subtotal: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },      // Percentage
  taxAmount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },

  // ── Status & Workflow ──
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected', 'ordered', 'partial', 'received', 'closed', 'cancelled'],
    default: 'draft',
  },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },

  // ── Approval Chain ──
  requestedBy: { type: String, required: true },
  requestedByName: { type: String },
  approvedBy: { type: String, default: null },
  approvedByName: { type: String, default: null },
  approvedAt: { type: Date, default: null },
  rejectedBy: { type: String, default: null },
  rejectionReason: { type: String, default: null },

  // ── Shipping & Delivery ──
  shippingMethod: { type: String, default: null },
  trackingNumber: { type: String, default: null },
  expectedDelivery: { type: Date, default: null },
  actualDelivery: { type: Date, default: null },
  deliveryNotes: { type: String, default: null },

  // ── Linked References ──
  linkedWorkOrderId: { type: String, default: null },  // PO created for a specific WO
  linkedAssetId: { type: String, default: null },

  // ── Notes & Attachments ──
  notes: { type: String, default: '' },
  internalNotes: { type: String, default: '' },
  attachments: [{
    fileName: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],

  // ── Terms ──
  paymentTerms: { type: String, default: 'Net 30' },  // Net 30, Net 60, COD, Prepaid
  warrantyTerms: { type: String, default: null },
}, { timestamps: true });

// Indexes for fast lookups
purchaseOrderSchema.index({ companyId: 1, status: 1 });
purchaseOrderSchema.index({ companyId: 1, vendorName: 1 });

// Pre-save: calculate totals
purchaseOrderSchema.pre('save', function () {
  if (this.items && this.items.length > 0) {
    this.items.forEach(item => {
      item.lineTotal = item.quantity * item.unitPrice;
    });
    this.subtotal = this.items.reduce((sum, item) => sum + item.lineTotal, 0);
    this.taxAmount = Math.round(this.subtotal * (this.taxRate / 100) * 100) / 100;
    this.totalAmount = this.subtotal + this.taxAmount + (this.shippingCost || 0);
  }
});

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
