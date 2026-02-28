const mongoose = require('mongoose');

// HIPAA §164.312(b) — Audit Controls
// 21 CFR Part 11 — Electronic Records, Electronic Signatures
// This collection is APPEND-ONLY. No updates or deletes allowed.
const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String },
  userRole: { type: String },
  companyId: { type: String, index: true },
  targetType: { type: String }, // 'workOrder', 'user', 'client', 'asset', 'inventory', 'system'
  targetId: { type: String },
  details: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed }, // Flexible data (IP, browser, etc.)
  ipAddress: { type: String },
  sessionId: { type: String },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: false, // We use our own timestamp field
  // CRITICAL: Disable modifications after creation
  strict: true
});

// Prevent updates and deletes at the schema level
auditLogSchema.pre('findOneAndUpdate', function() {
  throw new Error('HIPAA VIOLATION: Audit log entries cannot be modified.');
});
auditLogSchema.pre('findOneAndDelete', function() {
  throw new Error('HIPAA VIOLATION: Audit log entries cannot be deleted.');
});
auditLogSchema.pre('deleteOne', function() {
  throw new Error('HIPAA VIOLATION: Audit log entries cannot be deleted.');
});
auditLogSchema.pre('deleteMany', function() {
  throw new Error('HIPAA VIOLATION: Audit log entries cannot be deleted.');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
