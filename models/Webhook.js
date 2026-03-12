const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════════
 * WEBHOOK MODEL — Zapier/Custom Integration Triggers
 * Technical Made Easy
 *
 * Companies register webhook URLs to receive real-time event
 * notifications for WO lifecycle, PO workflow, and asset health.
 * ═══════════════════════════════════════════════════════════════════
 */

const webhookSchema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  name: { type: String, required: true },        // "Zapier WO Trigger", "Slack Alert"
  url: { type: String, required: true },          // HTTPS endpoint
  secret: { type: String, default: null },        // HMAC signing secret
  events: [{
    type: String,
    enum: [
      'wo.created', 'wo.completed', 'wo.assigned', 'wo.sla_breach', 'wo.status_changed',
      'po.created', 'po.approved', 'po.received',
      'asset.health_critical', 'asset.health_poor',
      'pm.due', 'pm.overdue',
      'inventory.low_stock',
    ],
  }],
  active: { type: Boolean, default: true },
  createdBy: { type: String },

  // ── Delivery Tracking ──
  lastFiredAt: { type: Date, default: null },
  lastStatus: { type: Number, default: null },     // HTTP status code
  failCount: { type: Number, default: 0 },         // Consecutive failures
  totalFired: { type: Number, default: 0 },
  // Auto-disable after 10 consecutive failures
  autoDisabled: { type: Boolean, default: false },
  autoDisabledAt: { type: Date, default: null },
}, { timestamps: true });

webhookSchema.index({ companyId: 1, active: 1 });

module.exports = mongoose.model('Webhook', webhookSchema);
