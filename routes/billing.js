const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const WorkOrder = require('../models/WorkOrder');
const Company = require('../models/Company');
const AuditLog = require('../models/AuditLog');

// ═══════════════════════════════════════════════════════════════════
// INVOICE GENERATION — Create invoice for a single WO
// @route    POST api/v1/billing/invoice/:woId
// @access   Private (COMPANY, ADMIN, OFFICE)
// ═══════════════════════════════════════════════════════════════════
router.post('/invoice/:woId', auth, async (req, res) => {
  try {
    const wo = await WorkOrder.findById(req.params.woId);
    if (!wo) return res.status(404).json({ msg: 'Work order not found' });
    if (wo.companyId !== req.user.companyId && req.user.role !== 'PLATFORM_OWNER') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { poNumber, billingRate, taxRate } = req.body;

    // Calculate invoice total
    const laborHours = (wo.timeEntries || [])
      .filter(t => t.billable !== false)
      .reduce((sum, t) => sum + (t.duration || 0), 0) / 60; // Convert minutes to hours

    const rate = billingRate || wo.billingRate || 85; // Default $85/hr
    const laborTotal = laborHours * rate;

    const partsTotal = (wo.partsUsed || [])
      .reduce((sum, p) => sum + ((p.unitPrice || 0) * (p.qty || 1)), 0);

    const subtotal = laborTotal + partsTotal;
    const tax = taxRate ? subtotal * (taxRate / 100) : 0;
    const invoiceTotal = subtotal + tax;

    // Generate invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Update WO with invoice data
    const updated = await WorkOrder.findByIdAndUpdate(req.params.woId, {
      $set: {
        invoiceNumber,
        invoicedAt: new Date(),
        poNumber: poNumber || wo.poNumber,
        billingRate: rate,
        taxRate: taxRate || 0,
        invoiceTotal,
        paymentStatus: 'invoiced',
        status: 'Invoiced',
        subStatus: 'Awaiting Payment',
      }
    }, { new: true });

    await AuditLog.create({
      action: 'INVOICE_CREATED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: wo._id.toString(),
      details: `Invoice ${invoiceNumber} created for ${wo.woNumber}. Total: $${invoiceTotal.toFixed(2)}`,
    });

    res.json({
      success: true,
      invoice: {
        invoiceNumber,
        woNumber: wo.woNumber,
        clientName: wo.clientName,
        accountNumber: wo.accountNumber,
        laborHours: Math.round(laborHours * 100) / 100,
        laborRate: rate,
        laborTotal: Math.round(laborTotal * 100) / 100,
        partsTotal: Math.round(partsTotal * 100) / 100,
        subtotal: Math.round(subtotal * 100) / 100,
        taxRate: taxRate || 0,
        taxAmount: Math.round(tax * 100) / 100,
        invoiceTotal: Math.round(invoiceTotal * 100) / 100,
        poNumber: poNumber || wo.poNumber,
        invoicedAt: updated.invoicedAt,
        timeEntries: wo.timeEntries,
        partsUsed: wo.partsUsed,
        site: wo.site,
        woType: wo.woType,
        model: wo.model,
        serialNumber: wo.serialNumber,
        techName: wo.assignedTechName,
      },
      wo: updated,
    });
  } catch (err) {
    console.error('Invoice Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// BATCH INVOICE — Generate invoices for multiple WOs grouped by client
// @route    POST api/v1/billing/batch-invoice
// @body     { woIds: [...], billingRate, taxRate }
// @access   Private (COMPANY, ADMIN, OFFICE)
// ═══════════════════════════════════════════════════════════════════
router.post('/batch-invoice', auth, async (req, res) => {
  try {
    const { woIds, billingRate, taxRate } = req.body;
    if (!woIds || !woIds.length) return res.status(400).json({ msg: 'No WO IDs provided' });

    const wos = await WorkOrder.find({
      _id: { $in: woIds },
      companyId: req.user.companyId,
    });

    if (wos.length === 0) return res.status(404).json({ msg: 'No matching work orders found' });

    // Group by client
    const clientGroups = {};
    wos.forEach(wo => {
      const key = wo.clientName || wo.accountNumber || 'Unknown';
      if (!clientGroups[key]) clientGroups[key] = [];
      clientGroups[key].push(wo);
    });

    const invoices = [];

    for (const [clientName, clientWOs] of Object.entries(clientGroups)) {
      const batchInvoiceNumber = `INV-${new Date().getFullYear()}-B${String(Date.now()).slice(-6)}`;
      let batchLaborTotal = 0;
      let batchPartsTotal = 0;

      for (const wo of clientWOs) {
        const laborHours = (wo.timeEntries || [])
          .filter(t => t.billable !== false)
          .reduce((sum, t) => sum + (t.duration || 0), 0) / 60;
        const rate = billingRate || wo.billingRate || 85;
        batchLaborTotal += laborHours * rate;
        batchPartsTotal += (wo.partsUsed || [])
          .reduce((sum, p) => sum + ((p.unitPrice || 0) * (p.qty || 1)), 0);
      }

      const subtotal = batchLaborTotal + batchPartsTotal;
      const tax = taxRate ? subtotal * (taxRate / 100) : 0;
      const invoiceTotal = subtotal + tax;

      // Update all WOs in batch
      await WorkOrder.updateMany(
        { _id: { $in: clientWOs.map(w => w._id) } },
        { $set: {
          invoiceNumber: batchInvoiceNumber,
          invoicedAt: new Date(),
          invoiceTotal: Math.round(invoiceTotal / clientWOs.length * 100) / 100,
          paymentStatus: 'invoiced',
          status: 'Invoiced',
          subStatus: 'Awaiting Payment',
        }}
      );

      invoices.push({
        invoiceNumber: batchInvoiceNumber,
        clientName,
        woCount: clientWOs.length,
        woNumbers: clientWOs.map(w => w.woNumber),
        laborTotal: Math.round(batchLaborTotal * 100) / 100,
        partsTotal: Math.round(batchPartsTotal * 100) / 100,
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: Math.round(tax * 100) / 100,
        invoiceTotal: Math.round(invoiceTotal * 100) / 100,
      });

      await AuditLog.create({
        action: 'BATCH_INVOICE_CREATED',
        userId: req.user.id,
        companyId: req.user.companyId,
        targetType: 'batch',
        targetId: batchInvoiceNumber,
        details: `Batch invoice ${batchInvoiceNumber} for ${clientName}: ${clientWOs.length} WOs, $${invoiceTotal.toFixed(2)}`,
      });
    }

    res.json({ success: true, invoices, totalInvoiced: invoices.length });
  } catch (err) {
    console.error('Batch Invoice Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// CONFIRM PAYMENT — Mark invoice as paid
// @route    PUT api/v1/billing/payment/:woId
// @access   Private
// ═══════════════════════════════════════════════════════════════════
router.put('/payment/:woId', auth, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const wo = await WorkOrder.findByIdAndUpdate(req.params.woId, {
      $set: {
        paymentStatus: 'paid',
        paidAt: new Date(),
        paymentMethod: paymentMethod || 'check',
        status: 'Finished',
        subStatus: 'Paid & Archived',
      }
    }, { new: true });

    if (!wo) return res.status(404).json({ msg: 'Work order not found' });

    await AuditLog.create({
      action: 'PAYMENT_CONFIRMED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: wo._id.toString(),
      details: `Payment confirmed for ${wo.woNumber} (${wo.invoiceNumber}). Method: ${paymentMethod || 'check'}`,
    });

    res.json({ success: true, wo });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// AGING REPORT — 30/60/90 day outstanding invoices
// @route    GET api/v1/billing/aging
// @access   Private (COMPANY, ADMIN, OFFICE)
// ═══════════════════════════════════════════════════════════════════
router.get('/aging', auth, async (req, res) => {
  try {
    const now = new Date();
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now - 90 * 24 * 60 * 60 * 1000);

    const unpaidWOs = await WorkOrder.find({
      companyId: req.user.companyId,
      paymentStatus: 'invoiced',
      invoicedAt: { $ne: null },
    }).sort({ invoicedAt: 1 });

    const buckets = {
      current: [],   // 0-30 days
      thirty: [],    // 31-60 days
      sixty: [],     // 61-90 days
      ninety: [],    // 90+ days
    };

    unpaidWOs.forEach(wo => {
      const invoiceDate = new Date(wo.invoicedAt);
      if (invoiceDate > d30)      buckets.current.push(wo);
      else if (invoiceDate > d60) buckets.thirty.push(wo);
      else if (invoiceDate > d90) buckets.sixty.push(wo);
      else                        buckets.ninety.push(wo);
    });

    const sum = (arr) => arr.reduce((s, w) => s + (w.invoiceTotal || 0), 0);

    // Group by client for each bucket
    const groupByClient = (arr) => {
      const groups = {};
      arr.forEach(wo => {
        const key = wo.clientName || 'Unknown';
        if (!groups[key]) groups[key] = { clientName: key, total: 0, count: 0, wos: [] };
        groups[key].total += wo.invoiceTotal || 0;
        groups[key].count++;
        groups[key].wos.push({
          woNumber: wo.woNumber,
          invoiceNumber: wo.invoiceNumber,
          invoiceTotal: wo.invoiceTotal,
          invoicedAt: wo.invoicedAt,
          daysOutstanding: Math.floor((now - new Date(wo.invoicedAt)) / (24 * 60 * 60 * 1000)),
        });
      });
      return Object.values(groups);
    };

    res.json({
      summary: {
        current:  { count: buckets.current.length, total: Math.round(sum(buckets.current) * 100) / 100 },
        thirtyDay:  { count: buckets.thirty.length, total: Math.round(sum(buckets.thirty) * 100) / 100 },
        sixtyDay:   { count: buckets.sixty.length, total: Math.round(sum(buckets.sixty) * 100) / 100 },
        ninetyPlus: { count: buckets.ninety.length, total: Math.round(sum(buckets.ninety) * 100) / 100 },
        grandTotal: Math.round(sum(unpaidWOs) * 100) / 100,
      },
      detail: {
        current: groupByClient(buckets.current),
        thirtyDay: groupByClient(buckets.thirty),
        sixtyDay: groupByClient(buckets.sixty),
        ninetyPlus: groupByClient(buckets.ninety),
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// BILLING SUMMARY — Revenue dashboard data
// @route    GET api/v1/billing/summary
// @access   Private (COMPANY, ADMIN, OFFICE)
// ═══════════════════════════════════════════════════════════════════
router.get('/summary', auth, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [readyToInvoice, invoiced, paidThisMonth, totalPaid] = await Promise.all([
      WorkOrder.countDocuments({ companyId, status: 'Completed', paymentStatus: { $in: [null, 'unpaid'] } }),
      WorkOrder.find({ companyId, paymentStatus: 'invoiced' }),
      WorkOrder.find({ companyId, paymentStatus: 'paid', paidAt: { $gte: monthStart } }),
      WorkOrder.find({ companyId, paymentStatus: 'paid' }),
    ]);

    const invoicedTotal = invoiced.reduce((s, w) => s + (w.invoiceTotal || 0), 0);
    const paidMonthTotal = paidThisMonth.reduce((s, w) => s + (w.invoiceTotal || 0), 0);
    const paidAllTimeTotal = totalPaid.reduce((s, w) => s + (w.invoiceTotal || 0), 0);

    res.json({
      readyToInvoice,
      outstandingCount: invoiced.length,
      outstandingTotal: Math.round(invoicedTotal * 100) / 100,
      paidThisMonth: Math.round(paidMonthTotal * 100) / 100,
      paidAllTime: Math.round(paidAllTimeTotal * 100) / 100,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// CREDIT MEMO — Issue credit against an invoice
// @route    POST api/v1/billing/credit-memo/:woId
// @body     { amount, reason }
// @access   Private (COMPANY, ADMIN, OFFICE)
// ═══════════════════════════════════════════════════════════════════
router.post('/credit-memo/:woId', auth, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ msg: 'Credit amount required' });

    const wo = await WorkOrder.findById(req.params.woId);
    if (!wo) return res.status(404).json({ msg: 'Work order not found' });
    if (wo.companyId !== req.user.companyId && req.user.role !== 'PLATFORM_OWNER') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const creditMemoNumber = `CM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const newTotal = Math.max(0, Math.round(((wo.invoiceTotal || 0) - amount) * 100) / 100);

    // Track credit memo history on the WO
    const creditEntry = {
      creditMemoNumber,
      amount: Math.round(amount * 100) / 100,
      reason: reason || 'Adjustment',
      issuedBy: req.user.name || req.user.email,
      issuedAt: new Date(),
    };

    const updated = await WorkOrder.findByIdAndUpdate(req.params.woId, {
      $set: { invoiceTotal: newTotal },
      $push: { creditMemos: creditEntry },
    }, { new: true });

    await AuditLog.create({
      action: 'CREDIT_MEMO_ISSUED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: wo._id.toString(),
      details: `Credit memo ${creditMemoNumber} for $${amount.toFixed(2)} on ${wo.invoiceNumber}. Reason: ${reason || 'Adjustment'}. New total: $${newTotal.toFixed(2)}`,
    });

    res.json({
      success: true,
      creditMemo: creditEntry,
      newInvoiceTotal: newTotal,
      wo: updated,
    });
  } catch (err) {
    console.error('Credit Memo Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// SEND REMINDER — Email payment reminder for overdue invoice
// @route    POST api/v1/billing/send-reminder/:woId
// @access   Private (COMPANY, ADMIN, OFFICE)
// ═══════════════════════════════════════════════════════════════════
router.post('/send-reminder/:woId', auth, async (req, res) => {
  try {
    const wo = await WorkOrder.findById(req.params.woId);
    if (!wo) return res.status(404).json({ msg: 'Work order not found' });
    if (wo.companyId !== req.user.companyId && req.user.role !== 'PLATFORM_OWNER') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Update reminder tracking
    const reminderCount = (wo.reminderCount || 0) + 1;
    const updated = await WorkOrder.findByIdAndUpdate(req.params.woId, {
      $set: {
        reminderCount,
        lastReminderAt: new Date(),
        subStatus: reminderCount >= 3 ? 'Final Notice' : 'Reminder Sent',
      },
    }, { new: true });

    await AuditLog.create({
      action: 'PAYMENT_REMINDER_SENT',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: wo._id.toString(),
      details: `Payment reminder #${reminderCount} sent for ${wo.invoiceNumber} ($${(wo.invoiceTotal || 0).toFixed(2)}) to ${wo.clientName}`,
    });

    // NOTE: Actual email sending would be handled via SendGrid/SES/etc.
    // For now, we log the action and return success.
    // HIPAA: Email will contain only invoice number and amount — NO patient data.

    res.json({
      success: true,
      reminderCount,
      msg: `Reminder #${reminderCount} queued for ${wo.clientName}`,
    });
  } catch (err) {
    console.error('Reminder Error:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
