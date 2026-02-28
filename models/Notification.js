const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  companyId: { type: String, index: true },
  type: { type: String, required: true }, // emergency, wo_complete, pm_complete, billing, rating, message, system
  title: { type: String, required: true },
  body: { type: String },
  read: { type: Boolean, default: false },
  relatedId: { type: String }, // WO id, message id, etc.
  relatedType: { type: String }, // 'workOrder', 'message', 'billing', etc.
  priority: { type: String, default: 'normal' }, // normal, high, emergency
  expiresAt: { type: Date }, // Auto-cleanup old notifications
}, { timestamps: true });

// TTL index: auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
