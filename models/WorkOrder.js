const mongoose = require('mongoose');

const workOrderSchema = new mongoose.Schema({
  woNumber: { type: String, required: true, unique: true },
  type: { type: String, default: 'WO' }, // WO or PM
  formType: { type: String, default: 'WO' },
  companyId: { type: String, required: true },
  clientId: { type: String, required: true },
  accountNumber: { type: String },
  clientName: { type: String },
  assetId: { type: String, default: null },
  serialNumber: { type: String },
  model: { type: String },
  skill: { type: String },
  woType: { type: String },
  status: { type: String, default: 'Active' },
  subStatus: { type: String, default: 'Unscheduled' },
  emergency: { type: Boolean, default: false },
  priority: { type: String, default: 'normal' },
  contact: { type: String },
  phone: { type: String },
  email: { type: String },
  site: { type: String },
  building: { type: String },
  location: { type: String },
  customerIssue: { type: String },
  woNotes: { type: String, default: '' },
  privateNotes: { type: String, default: '' },
  poNumber: { type: String, default: '' },
  assignedTechId: { type: String, default: null },
  assignedTechName: { type: String, default: null },
  createdBy: { type: String, required: true },
  messages: [{
    entryId: { type: String, default: () => `msg_${Date.now()}_${Math.random().toString(36).slice(2,8)}` },
    from: String,
    name: String,
    text: String,
    ts: Date
  }],
  procedures: [{
    entryId: { type: String, default: () => `proc_${Date.now()}_${Math.random().toString(36).slice(2,8)}` },
    step: String,
    result: String,
    critical: Boolean
  }],
  testEquipment: [{
    entryId: { type: String, default: () => `teq_${Date.now()}_${Math.random().toString(36).slice(2,8)}` },
    name: String,
    calibrationDate: String
  }],
  rating: {
    score: Number,
    comment: String,
    ratedAt: Date
  },
  timeEntries: [{
    entryId: { type: String, default: () => `te_${Date.now()}_${Math.random().toString(36).slice(2,8)}` },
    techId: String,
    techName: String,
    type: { type: String }, // 'labor' | 'travel'
    clockIn: Date,
    clockOut: Date,
    duration: Number,
    billable: Boolean
  }],
  partsUsed: [{
    entryId: { type: String, default: () => `part_${Date.now()}_${Math.random().toString(36).slice(2,8)}` },
    partId: String,
    name: String,
    sku: String,
    qty: Number,
    unitPrice: Number,
    addedAt: Date
  }],
  signatures: [{
    entryId: { type: String, default: () => `sig_${Date.now()}_${Math.random().toString(36).slice(2,8)}` },
    role: String,
    name: String,
    data: String, // base64
    signedAt: Date
  }],
  attachments: [{
    entryId: { type: String, default: () => `att_${Date.now()}_${Math.random().toString(36).slice(2,8)}` },
    fileName: String,
    fileType: String,
    url: String,
    uploadedAt: Date
  }],
  // ── Billing & Invoice ──
  invoiceNumber: { type: String, default: null },
  invoicedAt: { type: Date, default: null },
  paidAt: { type: Date, default: null },
  billingRate: { type: Number, default: 0 },  // $/hr labor rate
  taxRate: { type: Number, default: 0 },       // Tax percentage
  invoiceTotal: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['unpaid', 'invoiced', 'paid', 'overdue', 'write-off', null], default: null },
  paymentMethod: { type: String, default: null },
  sentToClient: { type: Boolean, default: false },
  // ── Sync tracking ──
  syncedFrom: { type: String, enum: ['web', 'mobile', 'api', null], default: null },
  lastSyncedAt: { type: Date, default: null },
  sentToArchive: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('WorkOrder', workOrderSchema);
