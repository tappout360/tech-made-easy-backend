/**
 * ═══════════════════════════════════════════════════════════════════
 * WEBHOOK SERVICE — Fire Events to Registered Endpoints
 * Technical Made Easy
 *
 * Sends POST requests to registered webhook URLs when events occur.
 * Features: HMAC signing, retry logic, auto-disable on failures,
 * delivery tracking.
 *
 * HIPAA Note: Webhook payloads NEVER contain PHI. Only operational
 * data (WO numbers, status, asset IDs) is sent. No patient data.
 * ═══════════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');
const Webhook = require('../models/Webhook');

/**
 * Fire a webhook event for a company.
 * @param {string} companyId - Company triggering the event
 * @param {string} event - Event name (e.g., 'wo.created')
 * @param {Object} payload - Event data (NO PHI)
 */
async function fireWebhook(companyId, event, payload) {
  try {
    const hooks = await Webhook.find({
      companyId,
      active: true,
      autoDisabled: false,
      events: event,
    });

    if (hooks.length === 0) return;

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const results = await Promise.allSettled(
      hooks.map(hook => deliverWebhook(hook, body))
    );

    // Log results (non-blocking)
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Webhook ${hooks[i].name} failed:`, r.reason?.message || r.reason);
      }
    });
  } catch (err) {
    console.error('Webhook fire error:', err.message);
  }
}

/**
 * Deliver a single webhook with HMAC signing and failure tracking.
 */
async function deliverWebhook(hook, body) {
  const headers = {
    'Content-Type': 'application/json',
    'X-TME-Event': JSON.parse(body).event,
    'X-TME-Timestamp': new Date().toISOString(),
    'X-TME-Delivery': crypto.randomUUID(),
  };

  // HMAC signature if secret is configured
  if (hook.secret) {
    const signature = crypto
      .createHmac('sha256', hook.secret)
      .update(body)
      .digest('hex');
    headers['X-TME-Signature'] = `sha256=${signature}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(hook.url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Update tracking
    await Webhook.findByIdAndUpdate(hook._id, {
      $set: {
        lastFiredAt: new Date(),
        lastStatus: response.status,
        failCount: response.ok ? 0 : hook.failCount + 1,
      },
      $inc: { totalFired: 1 },
    });

    // Auto-disable after 10 consecutive failures
    if (!response.ok && hook.failCount + 1 >= 10) {
      await Webhook.findByIdAndUpdate(hook._id, {
        $set: { autoDisabled: true, autoDisabledAt: new Date() },
      });
      console.warn(`Webhook "${hook.name}" auto-disabled after 10 consecutive failures`);
    }

    return { status: response.status, ok: response.ok };
  } catch (err) {
    await Webhook.findByIdAndUpdate(hook._id, {
      $set: { lastFiredAt: new Date(), lastStatus: 0 },
      $inc: { failCount: 1, totalFired: 1 },
    });

    if (hook.failCount + 1 >= 10) {
      await Webhook.findByIdAndUpdate(hook._id, {
        $set: { autoDisabled: true, autoDisabledAt: new Date() },
      });
    }

    throw err;
  }
}

/**
 * Convenience wrappers for common events
 */
const webhookEvents = {
  woCreated: (companyId, wo) => fireWebhook(companyId, 'wo.created', {
    woNumber: wo.woNumber, woType: wo.woType, priority: wo.priority,
    clientName: wo.clientName, model: wo.model, status: wo.status,
    slaDeadline: wo.sla?.deadline,
  }),

  woCompleted: (companyId, wo) => fireWebhook(companyId, 'wo.completed', {
    woNumber: wo.woNumber, woType: wo.woType, completedAt: new Date(),
    techName: wo.assignedTechName, mttrMinutes: wo.downtime?.mttrMinutes,
  }),

  woAssigned: (companyId, wo, techName) => fireWebhook(companyId, 'wo.assigned', {
    woNumber: wo.woNumber, assignedTo: techName, assignedAt: new Date(),
  }),

  woSLABreach: (companyId, wo) => fireWebhook(companyId, 'wo.sla_breach', {
    woNumber: wo.woNumber, priority: wo.priority, deadline: wo.sla?.deadline,
    clientName: wo.clientName, model: wo.model, breachedAt: new Date(),
  }),

  poApproved: (companyId, po) => fireWebhook(companyId, 'po.approved', {
    poNumber: po.poNumber, vendorName: po.vendorName, totalAmount: po.totalAmount,
    approvedBy: po.approvedByName, approvedAt: po.approvedAt,
  }),

  poReceived: (companyId, po) => fireWebhook(companyId, 'po.received', {
    poNumber: po.poNumber, vendorName: po.vendorName,
    receivedAt: new Date(), itemCount: po.items?.length,
  }),

  assetHealthCritical: (companyId, asset) => fireWebhook(companyId, 'asset.health_critical', {
    assetId: asset.assetId, model: asset.model, score: asset.score,
    grade: asset.grade, recommendation: asset.recommendation,
  }),

  inventoryLowStock: (companyId, item) => fireWebhook(companyId, 'inventory.low_stock', {
    name: item.name, sku: item.sku, currentQty: item.quantity,
    minQty: item.minQuantity, vendor: item.vendor,
  }),
};

module.exports = { fireWebhook, webhookEvents };
