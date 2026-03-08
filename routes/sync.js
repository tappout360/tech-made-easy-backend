/* ═══════════════════════════════════════════════════════════════════
   SYNC ROUTE — Merge-Safe Offline Sync for Web + Mobile
   Technical Made Easy — Backend API
   
   Key design: NEVER overwrites data. Arrays are union-merged by
   entryId, scalar fields use most-recent-timestamp-wins.
   HIPAA §164.312(c) — audit every merge operation.
   ═══════════════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const WorkOrder = require('../models/WorkOrder');
const AuditLog = require('../models/AuditLog');

// ── Field categories for merge algorithm ──
const SCALAR_FIELDS = [
  'status', 'subStatus', 'woType', 'skill', 'emergency', 'priority',
  'customerIssue', 'woNotes', 'privateNotes', 'poNumber',
  'assignedTechId', 'assignedTechName',
  'contact', 'phone', 'email', 'site', 'building', 'location',
  'model', 'serialNumber', 'assetId', 'accountNumber', 'clientName',
  'sentToArchive', 'rating',
];

const ARRAY_FIELDS = [
  'messages', 'procedures', 'testEquipment', 'timeEntries',
  'partsUsed', 'signatures', 'attachments',
];

/**
 * Merge incoming change into server document (additive only).
 * - Scalar fields: incoming wins if incoming.updatedAt > server.updatedAt
 * - Array fields: union-merge by entryId (never delete entries)
 * @returns {{ merged: Object, changedFields: string[] }}
 */
function mergeWorkOrder(serverDoc, incoming) {
  const merged = serverDoc.toObject ? serverDoc.toObject() : { ...serverDoc };
  const changedFields = [];
  const incomingTime = new Date(incoming.updatedAt || incoming.timestamp || 0);
  const serverTime = new Date(merged.updatedAt || 0);

  // ── Scalar merge: most recent wins ──
  for (const field of SCALAR_FIELDS) {
    if (incoming[field] !== undefined && incoming[field] !== merged[field]) {
      // Accept incoming if it's newer, or if server has no value
      if (incomingTime >= serverTime || merged[field] === null || merged[field] === undefined) {
        merged[field] = incoming[field];
        changedFields.push(field);
      }
    }
  }

  // ── Array merge: union by entryId (NEVER delete) ──
  for (const field of ARRAY_FIELDS) {
    if (!incoming[field] || !Array.isArray(incoming[field]) || incoming[field].length === 0) continue;

    const serverArr = merged[field] || [];
    const existingIds = new Set(serverArr.map(e => e.entryId || e.id || e._id?.toString()));

    for (const entry of incoming[field]) {
      const entryKey = entry.entryId || entry.id;
      if (entryKey && existingIds.has(entryKey)) {
        // Entry exists — update if incoming timestamp is newer
        const entryTime = new Date(entry.updatedAt || entry.ts || entry.clockOut || entry.addedAt || entry.signedAt || 0);
        const idx = serverArr.findIndex(e => (e.entryId || e.id) === entryKey);
        if (idx >= 0) {
          const serverEntryTime = new Date(
            serverArr[idx].updatedAt || serverArr[idx].ts || serverArr[idx].clockOut ||
            serverArr[idx].addedAt || serverArr[idx].signedAt || 0
          );
          if (entryTime > serverEntryTime) {
            serverArr[idx] = { ...serverArr[idx], ...entry };
            changedFields.push(`${field}[${entryKey}]`);
          }
        }
      } else {
        // New entry — append
        serverArr.push(entry);
        changedFields.push(`${field}[+${entryKey || 'new'}]`);
      }
    }

    merged[field] = serverArr;
  }

  // Update sync metadata
  merged.updatedAt = new Date();
  merged.lastSyncedAt = new Date();

  return { merged, changedFields };
}


// ─────────────────────────────────────────────────────────
// @route    POST /api/v1/sync/push
// @desc     Push offline changes — merge-safe, batch support
// @access   Private
// ─────────────────────────────────────────────────────────
router.post('/push', auth, async (req, res) => {
  try {
    const { changes, source = 'mobile' } = req.body;
    // changes = [{ woNumber, ...fields }, ...]

    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ msg: 'No changes provided' });
    }

    const results = [];
    const errors = [];

    for (const change of changes) {
      try {
        const { woNumber, id } = change;
        if (!woNumber && !id) {
          errors.push({ change, error: 'Missing woNumber or id' });
          continue;
        }

        // Look up existing document
        const query = woNumber ? { woNumber } : { id };
        let serverDoc = await WorkOrder.findOne(query);

        if (!serverDoc) {
          // New document — create it (handle offline-created WOs)
          change.syncedFrom = source;
          change.lastSyncedAt = new Date();
          if (!change.companyId) change.companyId = req.user.companyId;
          if (!change.createdBy) change.createdBy = req.user.id;
          serverDoc = await WorkOrder.create(change);
          results.push({
            woNumber: serverDoc.woNumber,
            action: 'created',
            merged: serverDoc,
          });

          // Audit
          await writeAudit(req.user, 'SYNC_CREATE', serverDoc.woNumber,
            `WO created via ${source} sync`, source);
          continue;
        }

        // Existing document — merge
        const { merged, changedFields } = mergeWorkOrder(serverDoc, change);
        merged.syncedFrom = source;

        // Apply merge using $set on changed fields only
        const updateOps = {};
        for (const key of Object.keys(merged)) {
          if (key === '_id' || key === '__v' || key === 'createdAt') continue;
          updateOps[key] = merged[key];
        }

        const updatedDoc = await WorkOrder.findByIdAndUpdate(
          serverDoc._id,
          { $set: updateOps, $inc: { __v: 1 } },
          { new: true }
        );

        results.push({
          woNumber: updatedDoc.woNumber,
          action: 'merged',
          changedFields,
          merged: updatedDoc,
        });

        // Audit
        if (changedFields.length > 0) {
          await writeAudit(req.user, 'SYNC_MERGE', updatedDoc.woNumber,
            `Merged ${changedFields.length} fields from ${source}: ${changedFields.slice(0, 5).join(', ')}${changedFields.length > 5 ? '...' : ''}`,
            source);
        }

      } catch (changeErr) {
        errors.push({
          woNumber: change.woNumber || change.id,
          error: changeErr.message,
        });
      }
    }

    res.json({
      ok: true,
      synced: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      serverTime: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[Sync Push] Error:', err.message);
    res.status(500).json({ msg: 'Sync push failed', error: err.message });
  }
});


// ─────────────────────────────────────────────────────────
// @route    GET /api/v1/sync/pull
// @desc     Pull changes since a timestamp (incremental sync)
// @access   Private
// ─────────────────────────────────────────────────────────
router.get('/pull', auth, async (req, res) => {
  try {
    const { since } = req.query;
    let query = {};

    // Scope by company (OWNER sees all)
    if (req.user.role !== 'OWNER') {
      query.companyId = req.user.companyId;
    }

    // Incremental: only docs modified after 'since'
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        query.updatedAt = { $gt: sinceDate };
      }
    }

    const docs = await WorkOrder.find(query)
      .sort({ updatedAt: -1 })
      .limit(500); // Safety cap

    res.json({
      ok: true,
      count: docs.length,
      documents: docs,
      serverTime: new Date().toISOString(),
      hasMore: docs.length === 500,
    });

  } catch (err) {
    console.error('[Sync Pull] Error:', err.message);
    res.status(500).json({ msg: 'Sync pull failed', error: err.message });
  }
});


// ─────────────────────────────────────────────────────────
// @route    GET /api/v1/sync/status
// @desc     Get sync health info
// @access   Private
// ─────────────────────────────────────────────────────────
router.get('/status', auth, async (req, res) => {
  try {
    const query = req.user.role !== 'OWNER'
      ? { companyId: req.user.companyId }
      : {};

    const totalWOs = await WorkOrder.countDocuments(query);
    const recentlySynced = await WorkOrder.countDocuments({
      ...query,
      lastSyncedAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    const lastSync = await WorkOrder.findOne({
      ...query,
      lastSyncedAt: { $ne: null }
    }).sort({ lastSyncedAt: -1 }).select('lastSyncedAt syncedFrom woNumber');

    res.json({
      ok: true,
      totalWorkOrders: totalWOs,
      syncedLast24h: recentlySynced,
      lastSync: lastSync ? {
        at: lastSync.lastSyncedAt,
        from: lastSync.syncedFrom,
        woNumber: lastSync.woNumber,
      } : null,
      serverTime: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[Sync Status] Error:', err.message);
    res.status(500).json({ msg: 'Sync status failed' });
  }
});


// ── Helper: Write audit entry ──
async function writeAudit(user, action, target, description, source) {
  try {
    if (AuditLog && typeof AuditLog.create === 'function') {
      await AuditLog.create({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action,
        targetType: 'workOrder',
        targetId: target,
        details: description,
        metadata: { source, syncedAt: new Date() },
        companyId: user.companyId,
        timestamp: new Date(),
      });
    }
  } catch (e) {
    // Non-blocking — log but don't fail the sync
    console.warn('[Sync Audit] Write failed:', e.message);
  }
}


module.exports = router;
