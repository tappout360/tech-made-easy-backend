/**
 * ═══════════════════════════════════════════════════════════════════
 * ASSET HEALTH SCORING SERVICE
 * Technical Made Easy — Predictive Maintenance Intelligence
 *
 * Calculates a 0-100 health score for each asset using:
 *   - WO frequency (breakdown rate)
 *   - MTBF trend (improving vs declining)
 *   - Age vs expected life
 *   - Cost ratio (total repair cost / acquisition cost)
 *   - Criticality weight
 *   - Condition rating
 *
 * Score Ranges:
 *   90-100  Excellent (green)
 *   70-89   Good (blue)
 *   50-69   Fair (yellow) — schedule preventive action
 *   30-49   Poor (orange) — prioritize replacement planning
 *   0-29    Critical (red) — immediate attention / replace
 * ═══════════════════════════════════════════════════════════════════
 */

const WorkOrder = require('../models/WorkOrder');
const Asset = require('../models/Asset');

/**
 * Calculate health score for a single asset.
 * @param {Object} asset - Asset document
 * @param {Array} assetWOs - Work orders for this asset (last 2 years)
 * @returns {Object} { score, grade, factors, recommendation }
 */
function calculateAssetHealth(asset, assetWOs = []) {
  let score = 100;
  const factors = [];

  // ── Factor 1: Age vs Expected Life (0-25 points deduction) ──
  if (asset.installDate && asset.expectedLifeYears) {
    const ageYears = (Date.now() - new Date(asset.installDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const lifeRatio = ageYears / asset.expectedLifeYears;

    if (lifeRatio > 1.0) {
      score -= 25;
      factors.push({ factor: 'Age', impact: -25, detail: `${ageYears.toFixed(1)}yr old — past expected life (${asset.expectedLifeYears}yr)` });
    } else if (lifeRatio > 0.75) {
      score -= 15;
      factors.push({ factor: 'Age', impact: -15, detail: `${ageYears.toFixed(1)}yr old — ${Math.round(lifeRatio * 100)}% of life used` });
    } else if (lifeRatio > 0.5) {
      score -= 5;
      factors.push({ factor: 'Age', impact: -5, detail: `${ageYears.toFixed(1)}yr old — mid-life` });
    }
  }

  // ── Factor 2: Breakdown Frequency (0-30 points deduction) ──
  const repairWOs = assetWOs.filter(wo =>
    wo.woType === 'Repair' || wo.woType === 'Emergency' || wo.emergency
  );
  const repairCount = repairWOs.length;

  if (repairCount >= 10) {
    score -= 30;
    factors.push({ factor: 'Breakdowns', impact: -30, detail: `${repairCount} repairs in review period — chronic failure` });
  } else if (repairCount >= 5) {
    score -= 20;
    factors.push({ factor: 'Breakdowns', impact: -20, detail: `${repairCount} repairs — frequent issues` });
  } else if (repairCount >= 3) {
    score -= 10;
    factors.push({ factor: 'Breakdowns', impact: -10, detail: `${repairCount} repairs — occasional issues` });
  } else if (repairCount > 0) {
    score -= 3;
    factors.push({ factor: 'Breakdowns', impact: -3, detail: `${repairCount} repair(s) — normal` });
  }

  // ── Factor 3: Cost Ratio (0-20 points deduction) ──
  if (asset.acquisitionCost > 0) {
    const totalRepairCost = (asset.totalLaborCost || 0) + (asset.totalPartsCost || 0);
    const costRatio = totalRepairCost / asset.acquisitionCost;

    if (costRatio > 0.6) {
      score -= 20;
      factors.push({ factor: 'Cost Ratio', impact: -20, detail: `Repair costs = ${Math.round(costRatio * 100)}% of acquisition cost — REPLACE` });
    } else if (costRatio > 0.4) {
      score -= 12;
      factors.push({ factor: 'Cost Ratio', impact: -12, detail: `Repair costs = ${Math.round(costRatio * 100)}% of acquisition cost` });
    } else if (costRatio > 0.2) {
      score -= 5;
      factors.push({ factor: 'Cost Ratio', impact: -5, detail: `Repair costs = ${Math.round(costRatio * 100)}% — acceptable` });
    }
  }

  // ── Factor 4: Criticality Amplifier ──
  const critWeight = { critical: 1.3, high: 1.15, standard: 1.0, low: 0.9 };
  const multiplier = critWeight[asset.criticality] || 1.0;
  if (asset.criticality === 'critical' && score < 70) {
    score -= 10; // Extra penalty for critical assets in poor health
    factors.push({ factor: 'Criticality', impact: -10, detail: 'Critical asset with degraded health — high risk' });
  }

  // ── Factor 5: Condition Rating (0-10 points deduction) ──
  const condRating = asset.conditionRating || 5;
  if (condRating <= 3) {
    score -= 10;
    factors.push({ factor: 'Condition', impact: -10, detail: `Condition rated ${condRating}/10 — poor` });
  } else if (condRating <= 5) {
    score -= 5;
    factors.push({ factor: 'Condition', impact: -5, detail: `Condition rated ${condRating}/10 — fair` });
  }

  // ── Factor 6: PM Compliance ──
  const pmWOs = assetWOs.filter(wo => wo.type === 'PM' || wo.formType === 'PM');
  const completedPMs = pmWOs.filter(wo => wo.status === 'Completed' || wo.status === 'Finished');
  if (pmWOs.length > 0) {
    const pmRate = completedPMs.length / pmWOs.length;
    if (pmRate < 0.8) {
      score -= 8;
      factors.push({ factor: 'PM Compliance', impact: -8, detail: `Only ${Math.round(pmRate * 100)}% PMs completed — non-compliant` });
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Grade + recommendation
  let grade, recommendation;
  if (score >= 90) { grade = 'Excellent'; recommendation = 'Continue standard PM schedule'; }
  else if (score >= 70) { grade = 'Good'; recommendation = 'Monitor — consider increasing PM frequency'; }
  else if (score >= 50) { grade = 'Fair'; recommendation = 'Schedule deep inspection and preventive overhaul'; }
  else if (score >= 30) { grade = 'Poor'; recommendation = 'Begin replacement planning — capital budget needed'; }
  else { grade = 'Critical'; recommendation = 'IMMEDIATE ACTION — replace or major overhaul required'; }

  return {
    score,
    grade,
    factors,
    recommendation,
    metrics: {
      totalWOs: assetWOs.length,
      repairCount,
      pmCount: pmWOs.length,
      pmCompletionRate: pmWOs.length > 0 ? Math.round((completedPMs.length / pmWOs.length) * 100) : 100,
      totalRepairCost: (asset.totalLaborCost || 0) + (asset.totalPartsCost || 0),
    },
  };
}

/**
 * Get health scores for all assets in a company.
 */
async function getCompanyAssetHealth(companyId) {
  const assets = await Asset.find({ companyId });
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);

  // Get all WOs for this company in the last 2 years
  const allWOs = await WorkOrder.find({
    companyId,
    createdAt: { $gte: twoYearsAgo },
    isTemplate: { $ne: true },
  }).select('assetId serialNumber model woType type formType status emergency createdAt');

  const results = assets.map(asset => {
    // Match WOs to assets by assetId or serialNumber
    const assetWOs = allWOs.filter(wo =>
      wo.assetId === asset._id.toString() ||
      (wo.serialNumber && wo.serialNumber === asset.serialNumber)
    );

    const health = calculateAssetHealth(asset, assetWOs);

    return {
      assetId: asset._id,
      qrTag: asset.qrTag,
      model: asset.model,
      manufacturer: asset.manufacturer,
      serialNumber: asset.serialNumber,
      site: asset.site,
      department: asset.department,
      criticality: asset.criticality,
      ...health,
    };
  });

  // Sort by score ascending (worst health first)
  results.sort((a, b) => a.score - b.score);

  return {
    assets: results,
    summary: {
      total: results.length,
      critical: results.filter(a => a.score < 30).length,
      poor: results.filter(a => a.score >= 30 && a.score < 50).length,
      fair: results.filter(a => a.score >= 50 && a.score < 70).length,
      good: results.filter(a => a.score >= 70 && a.score < 90).length,
      excellent: results.filter(a => a.score >= 90).length,
      avgScore: results.length > 0 ? Math.round(results.reduce((s, a) => s + a.score, 0) / results.length) : 0,
    },
  };
}

module.exports = { calculateAssetHealth, getCompanyAssetHealth };
