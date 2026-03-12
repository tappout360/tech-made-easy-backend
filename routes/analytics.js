const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const WorkOrder = require('../models/WorkOrder');
const Asset = require('../models/Asset');
const User = require('../models/User');
const { getCompanyAssetHealth } = require('../services/assetHealthService');

/**
 * ═══════════════════════════════════════════════════════════════════
 * ADVANCED ANALYTICS API
 * Technical Made Easy — BI-Level Reporting Endpoints
 *
 * All endpoints are company-scoped via auth middleware.
 * Returns quantified metrics for dashboards and exports.
 * ═══════════════════════════════════════════════════════════════════
 */

// ── 1. ASSET HEALTH SCORES ──
// @route    GET api/v1/analytics/asset-health
router.get('/asset-health', auth, async (req, res) => {
  try {
    const result = await getCompanyAssetHealth(req.user.companyId);
    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ── 2. DOWNTIME COST REPORT ──
// @route    GET api/v1/analytics/downtime-cost
router.get('/downtime-cost', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const wos = await WorkOrder.find({
      companyId: req.user.companyId,
      'downtime.reportedAt': { $gte: since },
      isTemplate: { $ne: true },
    }).select('woNumber model clientName downtime billingRate timeEntries');

    const hourlyRate = 150; // Default; override from company settings
    const report = wos.map(wo => {
      const mttr = wo.downtime?.mttrMinutes || 0;
      const laborHrs = (wo.timeEntries || []).reduce((s, te) => s + (te.duration || 0), 0) / 60;
      const laborCost = laborHrs * (wo.billingRate || hourlyRate);
      const downtimeCostPerHr = 500; // Avg hospital equipment downtime cost
      const downtimeCost = (mttr / 60) * downtimeCostPerHr;
      return {
        woNumber: wo.woNumber,
        equipment: wo.model,
        client: wo.clientName,
        mttrMinutes: mttr,
        laborHours: Math.round(laborHrs * 10) / 10,
        laborCost: Math.round(laborCost),
        estimatedDowntimeCost: Math.round(downtimeCost),
        totalImpact: Math.round(laborCost + downtimeCost),
        category: wo.downtime?.downtimeCategory || 'unplanned',
      };
    });

    report.sort((a, b) => b.totalImpact - a.totalImpact);

    res.json({
      period: `Last ${days} days`,
      incidents: report.length,
      totalLaborCost: report.reduce((s, r) => s + r.laborCost, 0),
      totalDowntimeCost: report.reduce((s, r) => s + r.estimatedDowntimeCost, 0),
      totalImpact: report.reduce((s, r) => s + r.totalImpact, 0),
      avgMTTR: report.length > 0 ? Math.round(report.reduce((s, r) => s + r.mttrMinutes, 0) / report.length) : 0,
      details: report,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ── 3. FAILURE TRENDS (Pareto Analysis) ──
// @route    GET api/v1/analytics/failure-trends
router.get('/failure-trends', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 365;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const wos = await WorkOrder.find({
      companyId: req.user.companyId,
      failureCategory: { $ne: null },
      createdAt: { $gte: since },
      isTemplate: { $ne: true },
    }).select('failureCode failureCategory failureSeverity model clientName');

    // Group by failure category
    const categoryMap = {};
    const codeMap = {};
    wos.forEach(wo => {
      const cat = wo.failureCategory || 'Unknown';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
      if (wo.failureCode) {
        codeMap[wo.failureCode] = (codeMap[wo.failureCode] || 0) + 1;
      }
    });

    // Sort by frequency (Pareto)
    const categories = Object.entries(categoryMap)
      .map(([name, count]) => ({ name, count, percent: Math.round((count / wos.length) * 100) }))
      .sort((a, b) => b.count - a.count);

    const topCodes = Object.entries(codeMap)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Cumulative % for Pareto
    let cumulative = 0;
    categories.forEach(c => {
      cumulative += c.percent;
      c.cumulativePercent = cumulative;
    });

    res.json({
      period: `Last ${days} days`,
      totalFailures: wos.length,
      byCategory: categories,
      topFailureCodes: topCodes,
      pareto80: categories.filter(c => c.cumulativePercent <= 80).map(c => c.name),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ── 4. TECH PERFORMANCE SCORECARD ──
// @route    GET api/v1/analytics/tech-performance
router.get('/tech-performance', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const techs = await User.find({
      companyId: req.user.companyId,
      role: 'TECH',
      active: true,
    }).select('name email techSkill rating skills');

    const wos = await WorkOrder.find({
      companyId: req.user.companyId,
      createdAt: { $gte: since },
      assignedTechId: { $ne: null },
      isTemplate: { $ne: true },
    }).select('assignedTechId assignedTechName status sla downtime timeEntries createdAt');

    const scorecard = techs.map(tech => {
      const techWOs = wos.filter(wo => wo.assignedTechId === tech._id.toString());
      const completed = techWOs.filter(wo => wo.status === 'Completed' || wo.status === 'Finished');
      const slaBreached = techWOs.filter(wo => wo.sla?.breached);
      const avgMTTR = completed.filter(wo => wo.downtime?.mttrMinutes)
        .reduce((s, wo, _, arr) => s + wo.downtime.mttrMinutes / arr.length, 0);
      const totalLabor = techWOs.reduce((s, wo) =>
        s + (wo.timeEntries || []).reduce((ts, te) => ts + (te.duration || 0), 0), 0);

      return {
        techId: tech._id,
        name: tech.name,
        skill: tech.techSkill,
        rating: tech.rating,
        totalWOs: techWOs.length,
        completed: completed.length,
        completionRate: techWOs.length > 0 ? Math.round((completed.length / techWOs.length) * 100) : 0,
        slaBreaches: slaBreached.length,
        slaCompliance: techWOs.length > 0 ? Math.round(((techWOs.length - slaBreached.length) / techWOs.length) * 100) : 100,
        avgMTTR: Math.round(avgMTTR),
        totalLaborMinutes: Math.round(totalLabor),
      };
    });

    scorecard.sort((a, b) => b.slaCompliance - a.slaCompliance || b.completionRate - a.completionRate);

    res.json({
      period: `Last ${days} days`,
      techs: scorecard,
      summary: {
        totalTechs: scorecard.length,
        avgSLACompliance: scorecard.length > 0 ? Math.round(scorecard.reduce((s, t) => s + t.slaCompliance, 0) / scorecard.length) : 0,
        avgCompletionRate: scorecard.length > 0 ? Math.round(scorecard.reduce((s, t) => s + t.completionRate, 0) / scorecard.length) : 0,
        totalWOsCompleted: scorecard.reduce((s, t) => s + t.completed, 0),
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ── 5. PM COMPLIANCE RATE ──
// @route    GET api/v1/analytics/pm-compliance
router.get('/pm-compliance', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 365;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pmWOs = await WorkOrder.find({
      companyId: req.user.companyId,
      $or: [{ type: 'PM' }, { formType: 'PM' }],
      createdAt: { $gte: since },
      isTemplate: { $ne: true },
    }).select('woNumber status clientName model site createdAt');

    const total = pmWOs.length;
    const completed = pmWOs.filter(wo => wo.status === 'Completed' || wo.status === 'Finished').length;
    const overdue = pmWOs.filter(wo => wo.status === 'Active' || wo.status === 'Dispatched').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 100;

    // Joint Commission requires 100% PM completion
    const tjcCompliant = rate === 100;

    res.json({
      period: `Last ${days} days`,
      totalPMs: total,
      completed,
      overdue,
      complianceRate: rate,
      tjcCompliant,
      target: 100,
      gap: Math.max(0, 100 - rate),
      overdueList: pmWOs.filter(wo => wo.status === 'Active' || wo.status === 'Dispatched')
        .map(wo => ({ woNumber: wo.woNumber, client: wo.clientName, equipment: wo.model, site: wo.site })),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ── 6. PLATFORM CAPABILITIES SUMMARY (Public, for demo proof) ──
// @route    GET api/v1/analytics/capabilities
router.get('/capabilities', async (req, res) => {
  try {
    const [woCount, assetCount, userCount] = await Promise.all([
      WorkOrder.countDocuments({ isTemplate: { $ne: true } }),
      Asset.countDocuments(),
      User.countDocuments(),
    ]);

    res.json({
      platform: 'Technical Made Easy',
      version: '2.5.0',
      capabilities: {
        workOrderEngine: { features: 22, fields: 45, slaTracking: true, recurring: true, templates: true, bulkOps: true, failureCodes: true },
        assetManagement: { healthScoring: true, hierarchy: true, lifecycleCost: true, mttrMtbf: true, fdaRecallTracking: true },
        purchaseOrders: { fullWorkflow: true, approvalChain: true, autoStockUpdate: true, vendorManagement: true },
        compliance: { hipaa: true, baa: true, auditLogging: true, jointCommission: true, fda21cfr: true, osha: true, nfpa99: true },
        ai: { butlerAssistant: true, equipmentTypes: 300, predictiveHealthScore: true, skillMatching: true, autoDispatch: true },
        integrations: { total: 15, list: ['QuickBooks', 'Stripe', 'Zoom', 'Slack', 'Teams', 'DocuSign', 'Google Calendar', 'Google Maps', 'Salesforce', 'SAP', 'ServiceNow', 'P21 ERP', 'Paylocity', 'BACnet IoT', 'HL7 FHIR'] },
        mobile: { pwa: true, offline: true, qrScanner: true, gpsCheckin: true, photoCapture: true },
        analytics: { assetHealth: true, downtimeCost: true, failurePareto: true, techScorecard: true, pmCompliance: true, slaTracking: true },
        roles: 7,
        languages: 6,
      },
      liveMetrics: {
        totalWorkOrders: woCount,
        totalAssets: assetCount,
        totalUsers: userCount,
      },
    });
  } catch (err) {
    res.json({ platform: 'Technical Made Easy', status: 'operational' });
  }
});

module.exports = router;
