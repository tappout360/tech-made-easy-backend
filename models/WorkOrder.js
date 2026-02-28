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
    from: String,
    name: String,
    text: String,
    ts: Date
  }],
  procedures: [{
    step: String,
    result: String,
    critical: Boolean
  }],
  testEquipment: [{
    name: String,
    calibrationDate: String
  }],
  rating: {
    score: Number,
    comment: String,
    ratedAt: Date
  },
  timeEntries: [{
    techId: String,
    techName: String,
    type: { type: String }, // 'labor' | 'travel'
    clockIn: Date,
    clockOut: Date,
    duration: Number,
    billable: Boolean
  }],
  sentToArchive: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('WorkOrder', workOrderSchema);
