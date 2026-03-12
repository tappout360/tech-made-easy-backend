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
  // ── Multi-Tech Crew (for installs / team jobs) ──
  additionalTechs: [{
    techId: { type: String, required: true },
    techName: { type: String, required: true },
    addedBy: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
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
  sentToArchive: { type: Boolean, default: false },

  // ═══════════════════════════════════════════════════════════════
  // SLA TRACKING — Service Level Agreement timers
  // ═══════════════════════════════════════════════════════════════
  sla: {
    deadline: { type: Date, default: null },        // Auto-calculated from priority
    responseDeadline: { type: Date, default: null }, // Time to first tech response
    breached: { type: Boolean, default: false },     // True if deadline passed without completion
    respondedAt: { type: Date, default: null },      // When tech first acknowledged
    resolvedAt: { type: Date, default: null },       // When WO marked Complete
    pausedAt: { type: Date, default: null },         // SLA pause (e.g., waiting for parts)
    totalPausedMs: { type: Number, default: 0 },     // Total paused duration
  },

  // ═══════════════════════════════════════════════════════════════
  // RECURRING WO / AUTO-PM SCHEDULING
  // ═══════════════════════════════════════════════════════════════
  recurrence: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual', null], default: null },
    dayOfWeek: { type: Number, default: null },      // 0=Sun, 1=Mon, etc.
    dayOfMonth: { type: Number, default: null },     // 1-31
    nextDueDate: { type: Date, default: null },
    lastGeneratedAt: { type: Date, default: null },
    parentWoId: { type: String, default: null },     // Original template WO
    generatedCount: { type: Number, default: 0 },
    autoAssignTechId: { type: String, default: null }, // Auto-assign same tech
  },

  // ═══════════════════════════════════════════════════════════════
  // WO TEMPLATES — Save/load pre-filled configurations
  // ═══════════════════════════════════════════════════════════════
  isTemplate: { type: Boolean, default: false },      // If true, this WO is a reusable template
  templateName: { type: String, default: null },      // "Annual Sterilizer PM", "MRI Chiller Check"
  templateCategory: { type: String, default: null },  // "PM", "Repair", "Install", "Inspection"
  createdFromTemplate: { type: String, default: null }, // Template WO ID this was created from

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY ESCALATION — Auto-escalate if unassigned
  // ═══════════════════════════════════════════════════════════════
  escalation: {
    level: { type: Number, default: 0 },             // 0=none, 1=office, 2=admin, 3=owner
    lastEscalatedAt: { type: Date, default: null },
    escalationHistory: [{
      fromLevel: Number,
      toLevel: Number,
      reason: String,
      escalatedAt: { type: Date, default: Date.now },
    }],
  },

  // ═══════════════════════════════════════════════════════════════
  // MTTR / MTBF — Equipment Downtime Tracking
  // ═══════════════════════════════════════════════════════════════
  downtime: {
    reportedAt: { type: Date, default: null },       // When equipment went down
    restoredAt: { type: Date, default: null },       // When equipment returned to service
    mttrMinutes: { type: Number, default: null },    // Mean Time To Repair (auto-calculated)
    downtimeCategory: { type: String, enum: ['planned', 'unplanned', 'emergency', null], default: null },
  },

  // ═══════════════════════════════════════════════════════════════
  // GPS CHECK-IN / CHECK-OUT
  // ═══════════════════════════════════════════════════════════════
  geoCheckin: {
    arrivedAt: { type: Date, default: null },
    arrivedLat: { type: Number, default: null },
    arrivedLng: { type: Number, default: null },
    departedAt: { type: Date, default: null },
    departedLat: { type: Number, default: null },
    departedLng: { type: Number, default: null },
    onSiteMinutes: { type: Number, default: null },  // Auto-calculated
    travelMinutes: { type: Number, default: null },
  },

  // ═══════════════════════════════════════════════════════════════
  // PHOTO BEFORE / AFTER
  // ═══════════════════════════════════════════════════════════════
  photos: {
    before: [{ url: String, caption: String, takenAt: { type: Date, default: Date.now } }],
    after:  [{ url: String, caption: String, takenAt: { type: Date, default: Date.now } }],
  },

  // ═══════════════════════════════════════════════════════════════
  // CUSTOM FIELDS — Per-company extensibility
  // ═══════════════════════════════════════════════════════════════
  customFields: { type: Map, of: mongoose.Schema.Types.Mixed, default: new Map() },
}, { timestamps: true });

module.exports = mongoose.model('WorkOrder', workOrderSchema);
