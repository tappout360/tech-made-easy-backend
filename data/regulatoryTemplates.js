/**
 * ═══════════════════════════════════════════════════════════════════
 * REGULATORY INSPECTION TEMPLATES
 * Technical Made Easy — Pre-built Compliance Checklists
 *
 * Covers: Joint Commission (TJC), CMS, OSHA, FDA 21 CFR, NFPA 99
 * Each template is a checklist of inspection items that can be
 * loaded into a WO template for recurring compliance inspections.
 * ═══════════════════════════════════════════════════════════════════
 */

const REGULATORY_TEMPLATES = Object.freeze({
  // ═══════════════════════════════════════════════════════════════
  // JOINT COMMISSION (TJC) — Healthcare Equipment Management
  // ═══════════════════════════════════════════════════════════════
  'TJC-EC-02-04-01': {
    name: 'Joint Commission EC.02.04.01 — Equipment Maintenance',
    category: 'Joint Commission',
    standard: 'EC.02.04.01',
    frequency: 'annual',
    description: 'Medical equipment maintenance and inspection program compliance.',
    items: [
      { step: 'Verify equipment is included in the equipment management inventory', critical: true },
      { step: 'Confirm risk assessment (AEM/EQ89) has been performed', critical: true },
      { step: 'Check PM performed per manufacturer recommendations or AEM alternative', critical: true },
      { step: 'Verify equipment safety testing completed (electrical leakage, grounding)', critical: true },
      { step: 'Confirm operator training documentation current', critical: false },
      { step: 'Verify service history is complete and accessible', critical: true },
      { step: 'Check for open FDA recalls or safety alerts', critical: true },
      { step: 'Validate calibration is current (if applicable)', critical: true },
      { step: 'Confirm equipment labels and markings legible', critical: false },
      { step: 'Verify alarm systems functional and tested', critical: true },
      { step: 'Document all findings and corrective actions', critical: true },
    ],
  },

  'TJC-EC-02-04-03': {
    name: 'Joint Commission EC.02.04.03 — Fire Safety Equipment',
    category: 'Joint Commission',
    standard: 'EC.02.04.03',
    frequency: 'monthly',
    items: [
      { step: 'Inspect fire extinguishers — pressure gauge in green zone', critical: true },
      { step: 'Verify fire extinguisher access unobstructed', critical: true },
      { step: 'Test fire alarm pull stations', critical: true },
      { step: 'Verify fire doors close and latch properly', critical: true },
      { step: 'Inspect sprinkler heads — no obstructions within 18 inches', critical: true },
      { step: 'Check emergency lighting and exit signs functional', critical: true },
      { step: 'Verify evacuation maps posted and current', critical: false },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // CMS CONDITIONS OF PARTICIPATION
  // ═══════════════════════════════════════════════════════════════
  'CMS-482-41': {
    name: 'CMS §482.41 — Condition of Participation: Physical Environment',
    category: 'CMS',
    standard: '§482.41',
    frequency: 'annual',
    description: 'Physical environment equipment safety and maintenance requirements.',
    items: [
      { step: 'Verify all life support equipment on preventive maintenance program', critical: true },
      { step: 'Confirm medical gas system inspections current', critical: true },
      { step: 'Check electrical distribution system maintenance records', critical: true },
      { step: 'Verify emergency power system tested per NFPA 110', critical: true },
      { step: 'Confirm HVAC systems maintaining proper air exchanges', critical: true },
      { step: 'Verify water management program active (Legionella prevention)', critical: true },
      { step: 'Check nurse call system functionality', critical: true },
      { step: 'Confirm elevator inspections current', critical: false },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // OSHA — Occupational Safety
  // ═══════════════════════════════════════════════════════════════
  'OSHA-LOCKOUT-TAGOUT': {
    name: 'OSHA Lockout/Tagout (LOTO) Inspection',
    category: 'OSHA',
    standard: '29 CFR 1910.147',
    frequency: 'annual',
    items: [
      { step: 'Verify LOTO procedures documented for each piece of equipment', critical: true },
      { step: 'Confirm authorized employees trained and certified', critical: true },
      { step: 'Check lockout devices available and in good condition', critical: true },
      { step: 'Verify LOTO procedures posted at equipment location', critical: false },
      { step: 'Perform periodic audit of LOTO procedures', critical: true },
      { step: 'Confirm affected employees aware of LOTO requirements', critical: true },
    ],
  },

  'OSHA-BLOODBORNE': {
    name: 'OSHA Bloodborne Pathogens Compliance',
    category: 'OSHA',
    standard: '29 CFR 1910.1030',
    frequency: 'annual',
    items: [
      { step: 'Verify Exposure Control Plan updated within last 12 months', critical: true },
      { step: 'Confirm sharps containers available and not overfilled', critical: true },
      { step: 'Check PPE availability (gloves, gowns, face shields)', critical: true },
      { step: 'Verify Hepatitis B vaccination offered to at-risk employees', critical: true },
      { step: 'Confirm biohazard labels on all containers', critical: true },
      { step: 'Review decontamination procedures for equipment', critical: true },
    ],
  },

  'OSHA-ELECTRICAL': {
    name: 'OSHA Electrical Safety Inspection',
    category: 'OSHA',
    standard: '29 CFR 1910.301-399',
    frequency: 'quarterly',
    items: [
      { step: 'Inspect electrical panels — 36-inch clearance maintained', critical: true },
      { step: 'Verify GFCI outlets tested and functional', critical: true },
      { step: 'Check extension cord usage compliant (no daisy-chaining)', critical: true },
      { step: 'Verify all junction boxes covered', critical: true },
      { step: 'Confirm electrical equipment grounding intact', critical: true },
      { step: 'Check for damaged cords, plugs, or receptacles', critical: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // FDA 21 CFR PART 820 — Quality System Regulation
  // ═══════════════════════════════════════════════════════════════
  'FDA-820-QSR': {
    name: 'FDA 21 CFR Part 820 — Quality System Regulation',
    category: 'FDA',
    standard: '21 CFR 820',
    frequency: 'annual',
    description: 'Quality system requirements for medical device service and maintenance.',
    items: [
      { step: 'Verify service records maintained per §820.184', critical: true },
      { step: 'Confirm calibration records current per §820.72', critical: true },
      { step: 'Check complaint handling procedures per §820.198', critical: true },
      { step: 'Verify CAPA process documented and active per §820.90', critical: true },
      { step: 'Confirm document control procedures per §820.40', critical: true },
      { step: 'Verify training records current per §820.25', critical: true },
      { step: 'Check electronic signature compliance per 21 CFR Part 11', critical: true },
      { step: 'Confirm audit trail integrity for all service records', critical: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // NFPA 99 — Healthcare Facilities Code
  // ═══════════════════════════════════════════════════════════════
  'NFPA-99-MEDICAL-GAS': {
    name: 'NFPA 99 — Medical Gas System Inspection',
    category: 'NFPA',
    standard: 'NFPA 99 Chapter 5',
    frequency: 'quarterly',
    items: [
      { step: 'Verify medical gas alarm systems operational', critical: true },
      { step: 'Check zone valve boxes accessible and labeled', critical: true },
      { step: 'Confirm medical air compressor maintenance current', critical: true },
      { step: 'Verify vacuum pump system operational', critical: true },
      { step: 'Check medical gas outlet/inlet testing records', critical: true },
      { step: 'Confirm manifold system inspection current', critical: true },
      { step: 'Verify nitrogen NF (surgical) system if applicable', critical: false },
    ],
  },

  'NFPA-99-ELECTRICAL': {
    name: 'NFPA 99 — Essential Electrical System',
    category: 'NFPA',
    standard: 'NFPA 99 Chapter 6',
    frequency: 'monthly',
    items: [
      { step: 'Test generator under load per NFPA 110', critical: true },
      { step: 'Verify transfer switch operation (≤10 seconds)', critical: true },
      { step: 'Check battery condition and electrolyte level', critical: true },
      { step: 'Confirm fuel supply adequate (minimum 24hr reserve)', critical: true },
      { step: 'Verify life safety branch circuits identified', critical: true },
      { step: 'Test UPS systems for critical equipment', critical: true },
    ],
  },
});

// Helper: Get all templates grouped by category
function getTemplatesByCategory() {
  const grouped = {};
  Object.entries(REGULATORY_TEMPLATES).forEach(([key, template]) => {
    const cat = template.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ key, ...template, itemCount: template.items.length });
  });
  return grouped;
}

// Helper: Get template keys list for API
function getTemplateList() {
  return Object.entries(REGULATORY_TEMPLATES).map(([key, t]) => ({
    key,
    name: t.name,
    category: t.category,
    standard: t.standard,
    frequency: t.frequency,
    itemCount: t.items.length,
    criticalCount: t.items.filter(i => i.critical).length,
  }));
}

module.exports = { REGULATORY_TEMPLATES, getTemplatesByCategory, getTemplateList };
