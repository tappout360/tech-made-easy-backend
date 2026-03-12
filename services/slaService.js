/**
 * ═══════════════════════════════════════════════════════════════════
 * SLA SERVICE — Service Level Agreement Management
 * Technical Made Easy
 *
 * Auto-calculates SLA deadlines based on WO priority:
 *   Emergency:  4 hours  (response: 30min)
 *   High:       8 hours  (response: 1hr)
 *   Normal:    24 hours  (response: 4hr)
 *   Low:       72 hours  (response: 8hr)
 *
 * Supports: SLA pause (waiting for parts), breach detection,
 * escalation triggers, and MTTR calculation.
 * ═══════════════════════════════════════════════════════════════════
 */

// SLA deadlines in milliseconds by priority
const SLA_CONFIG = Object.freeze({
  emergency: { resolve: 4 * 60 * 60 * 1000,   respond: 30 * 60 * 1000 },
  high:      { resolve: 8 * 60 * 60 * 1000,   respond: 60 * 60 * 1000 },
  normal:    { resolve: 24 * 60 * 60 * 1000,  respond: 4 * 60 * 60 * 1000 },
  low:       { resolve: 72 * 60 * 60 * 1000,  respond: 8 * 60 * 60 * 1000 },
});

// Escalation thresholds: if unassigned for X% of SLA, escalate
const ESCALATION_THRESHOLDS = Object.freeze([
  { percent: 0.25, level: 1, label: 'Office Admin' },
  { percent: 0.50, level: 2, label: 'Company Admin' },
  { percent: 0.75, level: 3, label: 'Company Owner' },
]);

/**
 * Calculate SLA deadlines for a new work order.
 * @param {string} priority - 'emergency', 'high', 'normal', 'low'
 * @param {Date} createdAt - WO creation timestamp
 * @returns {{ deadline: Date, responseDeadline: Date }}
 */
function calculateSLA(priority, createdAt = new Date()) {
  const config = SLA_CONFIG[priority] || SLA_CONFIG.normal;
  return {
    deadline: new Date(createdAt.getTime() + config.resolve),
    responseDeadline: new Date(createdAt.getTime() + config.respond),
    breached: false,
    respondedAt: null,
    resolvedAt: null,
    pausedAt: null,
    totalPausedMs: 0,
  };
}

/**
 * Check if an SLA has been breached.
 * Accounts for paused time.
 */
function checkSLABreach(wo) {
  if (!wo.sla?.deadline || wo.sla?.breached) return wo.sla?.breached || false;
  const now = Date.now();
  const pausedMs = wo.sla.totalPausedMs || 0;
  const effectiveDeadline = wo.sla.deadline.getTime() + pausedMs;
  return now > effectiveDeadline;
}

/**
 * Calculate remaining SLA time in milliseconds.
 * Returns negative if breached.
 */
function getSLARemaining(wo) {
  if (!wo.sla?.deadline) return null;
  const now = Date.now();
  const pausedMs = wo.sla.totalPausedMs || 0;
  const effectiveDeadline = wo.sla.deadline.getTime() + pausedMs;
  return effectiveDeadline - now;
}

/**
 * Format SLA remaining for display.
 * @returns {string} e.g. "2h 15m", "BREACHED (1h 30m ago)"
 */
function formatSLARemaining(remainingMs) {
  if (remainingMs === null) return 'No SLA';
  const absMs = Math.abs(remainingMs);
  const hours = Math.floor(absMs / (60 * 60 * 1000));
  const minutes = Math.floor((absMs % (60 * 60 * 1000)) / (60 * 1000));

  const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  if (remainingMs < 0) return `BREACHED (${timeStr} ago)`;
  if (remainingMs < 60 * 60 * 1000) return `⚠️ ${timeStr}`; // Under 1 hour = warning
  return timeStr;
}

/**
 * Determine SLA status color class.
 */
function getSLAStatusColor(remainingMs) {
  if (remainingMs === null) return 'gray';
  if (remainingMs < 0) return 'red';            // Breached
  if (remainingMs < 60 * 60 * 1000) return 'orange'; // < 1 hour
  if (remainingMs < 4 * 60 * 60 * 1000) return 'yellow'; // < 4 hours
  return 'green'; // Healthy
}

/**
 * Check if a WO should be escalated based on time without assignment.
 */
function checkEscalation(wo) {
  if (!wo.sla?.deadline || wo.assignedTechId) return null;
  const elapsed = Date.now() - new Date(wo.createdAt).getTime();
  const totalSLA = wo.sla.deadline.getTime() - new Date(wo.createdAt).getTime();
  const percentElapsed = elapsed / totalSLA;

  for (let i = ESCALATION_THRESHOLDS.length - 1; i >= 0; i--) {
    if (percentElapsed >= ESCALATION_THRESHOLDS[i].percent) {
      const threshold = ESCALATION_THRESHOLDS[i];
      if ((wo.escalation?.level || 0) < threshold.level) {
        return {
          shouldEscalate: true,
          newLevel: threshold.level,
          label: threshold.label,
          reason: `WO unassigned for ${Math.round(percentElapsed * 100)}% of SLA window`,
        };
      }
      break;
    }
  }
  return null;
}

/**
 * Calculate MTTR (Mean Time To Repair) from downtime data.
 */
function calculateMTTR(reportedAt, restoredAt) {
  if (!reportedAt || !restoredAt) return null;
  return Math.round((new Date(restoredAt) - new Date(reportedAt)) / (60 * 1000));
}

/**
 * Calculate next recurrence date based on frequency.
 */
function calculateNextRecurrence(frequency, fromDate = new Date()) {
  const next = new Date(fromDate);
  switch (frequency) {
    case 'daily':      next.setDate(next.getDate() + 1); break;
    case 'weekly':     next.setDate(next.getDate() + 7); break;
    case 'biweekly':   next.setDate(next.getDate() + 14); break;
    case 'monthly':    next.setMonth(next.getMonth() + 1); break;
    case 'quarterly':  next.setMonth(next.getMonth() + 3); break;
    case 'semiannual': next.setMonth(next.getMonth() + 6); break;
    case 'annual':     next.setFullYear(next.getFullYear() + 1); break;
    default: return null;
  }
  return next;
}

module.exports = {
  SLA_CONFIG,
  ESCALATION_THRESHOLDS,
  calculateSLA,
  checkSLABreach,
  getSLARemaining,
  formatSLARemaining,
  getSLAStatusColor,
  checkEscalation,
  calculateMTTR,
  calculateNextRecurrence,
};
