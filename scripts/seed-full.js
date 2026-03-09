// ═══════════════════════════════════════════════════════════════
//  FULL SEED — Rich mock data for manual testing
//  Creates realistic scenario with WOs in EVERY lifecycle stage
//
//  Usage: node scripts/seed-full.js
//  WARNING: This will DROP existing data and re-seed!
// ═══════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User       = require('../models/User');
const Company    = require('../models/Company');
const Client     = require('../models/Client');
const Asset      = require('../models/Asset');
const WorkOrder  = require('../models/WorkOrder');
const Inventory  = require('../models/Inventory');
const Notification = require('../models/Notification');

// ── Helpers ──
const d = (daysAgo, h = 8, m = 0) => {
  const dt = new Date(); dt.setDate(dt.getDate() - daysAgo);
  dt.setHours(h, m, 0, 0); return dt;
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected for full seeding');

    // ── Clear ──
    await Promise.all([
      User.deleteMany({}), Company.deleteMany({}), Client.deleteMany({}),
      Asset.deleteMany({}), WorkOrder.deleteMany({}), Inventory.deleteMany({}),
      Notification.deleteMany({})
    ]);
    console.log('🗑️  Cleared all collections');

    // ═══════════════════════════════════════════════════════
    //  1. COMPANY
    // ═══════════════════════════════════════════════════════
    const company = await Company.create({
      name: 'BiomediCorp Services',
      status: 'active',
      ownerId: 'owner-1',
      companySettings: {
        displayName: 'BiomediCorp Services',
        tagline: 'Precision Medical Equipment Management',
        logo: '🏥', accentColor: '#00e5ff',
        subscription: 'enterprise',
        features: {
          createWO: true, viewWOs: true, messages: true, calendar: true,
          archive: true, billing: true, assets: true, inventory: true,
          integrations: true
        }
      }
    });
    const cid = company._id.toString();

    // ═══════════════════════════════════════════════════════
    //  2. USERS — 12 accounts covering every role
    // ═══════════════════════════════════════════════════════
    const pw   = await bcrypt.hash('TechnicalTeamFirst4388', 12);
    const owPw = await bcrypt.hash('TechnicalTeamFirst4388', 12);

    const users = await User.insertMany([
      // Platform Owner (your account)
      { role: 'OWNER', name: 'Jason Mounts', email: 'jason@technical-made-easy.com',
        password: owPw, companyId: null, active: true },
      // Company Owner
      { role: 'COMPANY', name: 'Tom Bradley', email: 'tom@medserv.com',
        password: pw, companyId: cid, active: true },
      // Admins
      { role: 'ADMIN', name: 'Rachel Kim', email: 'rachel@biomedicorp.com',
        password: pw, companyId: cid, active: true },
      // Office Staff
      { role: 'OFFICE', name: 'Sarah Kim', email: 'sarah@biomedicorp.com',
        password: pw, companyId: cid, active: true },
      { role: 'OFFICE', name: 'David Chen', email: 'david@biomedicorp.com',
        password: pw, companyId: cid, active: true },
      // Technicians — varying skills/ratings
      { role: 'TECH', name: 'Carlos Rivera', email: 'carlos@biomedicorp.com',
        password: pw, companyId: cid, active: true, techSkill: 'Specialty', rating: 4.7 },
      { role: 'TECH', name: 'Aiden Park', email: 'aiden@biomedicorp.com',
        password: pw, companyId: cid, active: true, techSkill: 'Specialty', rating: 4.9 },
      { role: 'TECH', name: 'Mike Thompson', email: 'mike@biomedicorp.com',
        password: pw, companyId: cid, active: true, techSkill: 'Basic/General', rating: 4.5 },
      { role: 'TECH', name: 'Jasmin Torres', email: 'jasmin@biomedicorp.com',
        password: pw, companyId: cid, active: true, techSkill: 'Basic/General', rating: 4.3 },
      // Client portal users
      { role: 'CLIENT', name: 'Mercy General - Bio', email: 'biomed@mercygeneral.com',
        password: pw, companyId: cid, accountNumber: 'MG-1001',
        clientCompany: 'Mercy General Hospital', active: true },
      { role: 'CLIENT', name: 'St. Luke\'s Medical', email: 'biomed@stlukes.com',
        password: pw, companyId: cid, accountNumber: 'SL-2002',
        clientCompany: 'St. Luke\'s Medical Center', active: true },
      { role: 'CLIENT', name: 'Valley Children\'s', email: 'biomed@valleychildrens.com',
        password: pw, companyId: cid, accountNumber: 'VC-3003',
        clientCompany: 'Valley Children\'s Hospital', active: true },
    ]);
    const u = (name) => users.find(x => x.name.includes(name));
    console.log(`👥 Created ${users.length} users`);

    // ═══════════════════════════════════════════════════════
    //  3. CLIENTS — 5 facilities
    // ═══════════════════════════════════════════════════════
    const mgUser = u('Mercy');
    const slUser = u('Luke');
    const vcUser = u('Valley');
    const clients = await Client.insertMany([
      { accountNumber: 'MG-1001', name: 'Mercy General Hospital',
        contactName: 'Dr. Amanda Foster', phone: '(555) 100-1001',
        email: 'biomed@mercygeneral.com', address: '2175 Rosedale Hwy, Bakersfield, CA 93305',
        sites: ['Main Campus', 'East Wing', 'ER Annex'], companyId: cid,
        userId: mgUser._id.toString(), status: 'active', rating: 5 },
      { accountNumber: 'SL-2002', name: 'St. Luke\'s Medical Center',
        contactName: 'James Wheeler', phone: '(555) 200-2002',
        email: 'biomed@stlukes.com', address: '915 Chester Ave, Bakersfield, CA 93301',
        sites: ['Main Building', 'Surgery Center', 'Radiology Wing'], companyId: cid,
        userId: slUser._id.toString(), status: 'active', rating: 4 },
      { accountNumber: 'VC-3003', name: 'Valley Children\'s Hospital',
        contactName: 'Rosa Martinez', phone: '(555) 300-3003',
        email: 'biomed@valleychildrens.com', address: '9300 Valley Children Pl, Madera, CA 93636',
        sites: ['NICU', 'Pediatric Wing', 'Outpatient'], companyId: cid,
        userId: vcUser._id.toString(), status: 'active', rating: 5 },
      { accountNumber: 'SC-4004', name: 'Summit Clinic',
        contactName: 'George Hall', phone: '(555) 400-4004',
        email: 'admin@summitclinic.com', address: '1220 Discovery Way, Bakersfield, CA 93309',
        sites: ['Main Office', 'Lab'], companyId: cid,
        userId: mgUser._id.toString(), status: 'active', rating: 3 },
      { accountNumber: 'RV-5005', name: 'Riverside Urgent Care',
        contactName: 'Patricia Moore', phone: '(555) 500-5005',
        email: 'ops@riversideurgent.com', address: '430 Calloway Dr, Bakersfield, CA 93312',
        sites: ['Walk-in Center'], companyId: cid,
        userId: mgUser._id.toString(), status: 'active', rating: 4 },
    ]);
    console.log(`🏥 Created ${clients.length} clients`);

    // ═══════════════════════════════════════════════════════
    //  4. ASSETS — 12 pieces of equipment
    // ═══════════════════════════════════════════════════════
    const assets = await Asset.insertMany([
      { qrTag:'BIO0001', serialNumber:'SN-GE-001', cmNumber:'CM-001',
        model:'Carescape B650', manufacturer:'GE Healthcare', department:'ICU',
        site:'Main Campus', building:'A', location:'Room 401',
        clientId: clients[0]._id.toString(), companyId: cid,
        status:'operational', warrantyEnd:'2027-06-15', lastPM:'2026-01-15', pmCycle:'semi-annual' },
      { qrTag:'BIO0002', serialNumber:'SN-PHI-002', cmNumber:'CM-002',
        model:'IntelliVue MX800', manufacturer:'Philips', department:'OR',
        site:'Surgery Center', building:'B', location:'OR-3',
        clientId: clients[1]._id.toString(), companyId: cid,
        status:'operational', warrantyEnd:'2026-12-01', lastPM:'2026-02-01', pmCycle:'quarterly' },
      { qrTag:'BIO0003', serialNumber:'SN-MED-003', cmNumber:'CM-003',
        model:'Sigma Spectrum', manufacturer:'Baxter', department:'NICU',
        site:'NICU', building:'C', location:'Bay 12',
        clientId: clients[2]._id.toString(), companyId: cid,
        status:'needs-repair', warrantyEnd:'2025-09-01', lastPM:'2025-12-01', pmCycle:'annual' },
      { qrTag:'BIO0004', serialNumber:'SN-ZOL-004', cmNumber:'CM-004',
        model:'R Series', manufacturer:'ZOLL', department:'ER',
        site:'Main Campus', building:'A', location:'ER Bay 1',
        clientId: clients[0]._id.toString(), companyId: cid,
        status:'operational', warrantyEnd:'2027-03-01', lastPM:'2026-02-10', pmCycle:'semi-annual' },
      { qrTag:'BIO0005', serialNumber:'SN-DRA-005', cmNumber:'CM-005',
        model:'Fabius GS Premium', manufacturer:'Dräger', department:'OR',
        site:'Surgery Center', building:'B', location:'OR-1',
        clientId: clients[1]._id.toString(), companyId: cid,
        status:'operational', warrantyEnd:'2028-01-01', lastPM:'2026-01-20', pmCycle:'semi-annual' },
      { qrTag:'BIO0006', serialNumber:'SN-STR-006', cmNumber:'CM-006',
        model:'Stryker Endoscopy Tower', manufacturer:'Stryker', department:'Endo Lab',
        site:'Main Office', building:'A', location:'Endo Suite 2',
        clientId: clients[3]._id.toString(), companyId: cid,
        status:'operational', warrantyEnd:'2027-09-01', lastPM:'2026-01-10', pmCycle:'semi-annual' },
      { qrTag:'BIO0007', serialNumber:'SN-SIE-007', cmNumber:'CM-007',
        model:'Artis Zee', manufacturer:'Siemens Healthineers', department:'Cath Lab',
        site:'Main Campus', building:'D', location:'Cath Lab 1',
        clientId: clients[0]._id.toString(), companyId: cid,
        status:'operational', warrantyEnd:'2028-06-01', lastPM:'2025-11-15', pmCycle:'annual' },
      { qrTag:'BIO0008', serialNumber:'SN-HAM-008', cmNumber:'CM-008',
        model:'Hamilton C6', manufacturer:'Hamilton Medical', department:'ICU',
        site:'Main Campus', building:'A', location:'ICU Bed 8',
        clientId: clients[0]._id.toString(), companyId: cid,
        status:'operational', warrantyEnd:'2027-12-01', lastPM:'2026-02-20', pmCycle:'quarterly' },
      { qrTag:'BIO0009', serialNumber:'SN-PHI-009', cmNumber:'CM-009',
        model:'IntelliVue MX40', manufacturer:'Philips', department:'Telemetry',
        site:'East Wing', building:'E', location:'Tele Room 2',
        clientId: clients[0]._id.toString(), companyId: cid,
        status:'needs-repair', warrantyEnd:'2026-04-01', lastPM:'2025-10-15', pmCycle:'semi-annual' },
      { qrTag:'BIO0010', serialNumber:'SN-MAS-010', cmNumber:'CM-010',
        model:'Radical-7', manufacturer:'Masimo', department:'PACU',
        site:'Surgery Center', building:'B', location:'PACU Bay 4',
        clientId: clients[1]._id.toString(), companyId: cid,
        status:'operational', warrantyEnd:'2027-08-01', lastPM:'2026-01-30', pmCycle:'semi-annual' },
      { qrTag:'BIO0011', serialNumber:'SN-MIN-011', cmNumber:'CM-011',
        model:'Puritan Bennett 980', manufacturer:'Medtronic', department:'ICU',
        site:'Pediatric Wing', building:'F', location:'PICU 3',
        clientId: clients[2]._id.toString(), companyId: cid,
        status:'operational', warrantyEnd:'2028-02-01', lastPM:'2026-02-15', pmCycle:'quarterly' },
      { qrTag:'BIO0012', serialNumber:'SN-WEL-012', cmNumber:'CM-012',
        model:'Spot Vital Signs 4400', manufacturer:'Welch Allyn', department:'Walk-in',
        site:'Walk-in Center', building:'A', location:'Exam Room 1',
        clientId: clients[4]._id.toString(), companyId: cid,
        status:'operational', warrantyEnd:'2027-05-01', lastPM:'2026-03-01', pmCycle:'annual' },
    ]);
    console.log(`🔧 Created ${assets.length} assets`);

    // ═══════════════════════════════════════════════════════
    //  5. WORK ORDERS — 15 WOs spanning EVERY lifecycle stage
    // ═══════════════════════════════════════════════════════
    const carlos = u('Carlos'), aiden = u('Aiden'), mike = u('Mike'), jasmin = u('Jasmin');
    const sarah = u('Sarah'), david = u('David');

    const workOrders = await WorkOrder.insertMany([
      // ── PENDING / UNSCHEDULED (in Dispatch queue) ──
      { woNumber: 'WO-2026-0301-0001', type: 'WO', formType: 'WO',
        companyId: cid, clientId: clients[0]._id.toString(),
        accountNumber: 'MG-1001', clientName: 'Mercy General Hospital',
        assetId: assets[0]._id.toString(), serialNumber: 'SN-GE-001',
        model: 'Carescape B650', skill: 'Specialty', woType: 'Repair',
        status: 'Pending', subStatus: 'Unscheduled', emergency: false,
        contact: 'Dr. Amanda Foster', phone: '(555) 100-1001',
        email: 'biomed@mercygeneral.com', site: 'Main Campus',
        building: 'A', location: 'Room 401',
        customerIssue: 'SpO2 module displaying intermittent readings. Nurses report alarm fatigue from false low readings.',
        createdBy: sarah._id.toString() },

      { woNumber: 'WO-2026-0301-0002', type: 'WO', formType: 'WO',
        companyId: cid, clientId: clients[1]._id.toString(),
        accountNumber: 'SL-2002', clientName: 'St. Luke\'s Medical Center',
        assetId: assets[4]._id.toString(), serialNumber: 'SN-DRA-005',
        model: 'Fabius GS Premium', skill: 'Specialty', woType: 'Repair',
        status: 'Pending', subStatus: 'Unscheduled', emergency: false, priority: 'high',
        contact: 'James Wheeler', phone: '(555) 200-2002',
        email: 'biomed@stlukes.com', site: 'Surgery Center',
        building: 'B', location: 'OR-1',
        customerIssue: 'Vaporizer not calibrating. Sevoflurane concentration reading 0% despite full fill.',
        createdBy: sarah._id.toString() },

      // ── EMERGENCY — Unscheduled (needs immediate dispatch) ──
      { woNumber: 'WO-2026-0308-0001', type: 'WO', formType: 'WO',
        companyId: cid, clientId: clients[3]._id.toString(),
        accountNumber: 'SC-4004', clientName: 'Summit Clinic',
        assetId: assets[5]._id.toString(), serialNumber: 'SN-STR-006',
        model: 'Stryker Endoscopy Tower', skill: 'Specialty', woType: 'Emergency',
        status: 'Pending', subStatus: 'Unscheduled', emergency: true, priority: 'critical',
        contact: 'George Hall', phone: '(555) 400-4004',
        email: 'admin@summitclinic.com', site: 'Main Office',
        building: 'A', location: 'Endo Suite 2',
        customerIssue: 'EMERGENCY: Endoscopy tower image processor failure mid-procedure. Patient stable but procedures cancelled until fixed.',
        createdBy: david._id.toString() },

      { woNumber: 'WO-2026-0308-0002', type: 'WO', formType: 'WO',
        companyId: cid, clientId: clients[2]._id.toString(),
        accountNumber: 'VC-3003', clientName: 'Valley Children\'s Hospital',
        assetId: assets[2]._id.toString(), serialNumber: 'SN-MED-003',
        model: 'Sigma Spectrum', skill: 'Basic/General', woType: 'Emergency',
        status: 'Pending', subStatus: 'Unscheduled', emergency: true, priority: 'critical',
        contact: 'Rosa Martinez', phone: '(555) 300-3003',
        email: 'biomed@valleychildrens.com', site: 'NICU',
        building: 'C', location: 'Bay 12',
        customerIssue: 'EMERGENCY: Infusion pump showing "Downstream Occlusion" repeatedly. Patient on TPN. Need immediate response.',
        createdBy: sarah._id.toString() },

      { woNumber: 'WO-2026-0308-0003', type: 'WO', formType: 'WO',
        companyId: cid, clientId: clients[0]._id.toString(),
        accountNumber: 'MG-1001', clientName: 'Mercy General Hospital',
        assetId: assets[6]._id.toString(), serialNumber: 'SN-SIE-007',
        model: 'Artis Zee', skill: 'Specialty', woType: 'Emergency',
        status: 'Pending', subStatus: 'Unscheduled', emergency: true, priority: 'critical',
        contact: 'Dr. Amanda Foster', phone: '(555) 100-1001',
        email: 'biomed@mercygeneral.com', site: 'Main Campus',
        building: 'D', location: 'Cath Lab 1',
        customerIssue: 'EMERGENCY: C-arm fluoroscopy not producing image. Cath lab shut down. 3 scheduled procedures postponed.',
        createdBy: david._id.toString() },

      // ── DISPATCHED — Assigned to tech, not started ──
      { woNumber: 'WO-2026-0305-0001', type: 'WO', formType: 'WO',
        companyId: cid, clientId: clients[0]._id.toString(),
        accountNumber: 'MG-1001', clientName: 'Mercy General Hospital',
        assetId: assets[7]._id.toString(), serialNumber: 'SN-HAM-008',
        model: 'Hamilton C6', skill: 'Specialty', woType: 'PM Inspection',
        status: 'Active', subStatus: 'Dispatched', emergency: false,
        contact: 'Dr. Amanda Foster', phone: '(555) 100-1001',
        email: 'biomed@mercygeneral.com', site: 'Main Campus',
        building: 'A', location: 'ICU Bed 8',
        customerIssue: 'Quarterly PM inspection due. Ventilator running 24/7 — coordinate with nursing for downtime.',
        assignedTechId: carlos._id.toString(), assignedTechName: 'Carlos Rivera',
        createdBy: sarah._id.toString() },

      { woNumber: 'WO-2026-0306-0001', type: 'WO', formType: 'WO',
        companyId: cid, clientId: clients[4]._id.toString(),
        accountNumber: 'RV-5005', clientName: 'Riverside Urgent Care',
        assetId: assets[11]._id.toString(), serialNumber: 'SN-WEL-012',
        model: 'Spot Vital Signs 4400', skill: 'Basic/General', woType: 'PM Inspection',
        status: 'Active', subStatus: 'Dispatched', emergency: false,
        contact: 'Patricia Moore', phone: '(555) 500-5005',
        email: 'ops@riversideurgent.com', site: 'Walk-in Center',
        building: 'A', location: 'Exam Room 1',
        customerIssue: 'Annual PM inspection. Unit also intermittently not powering on — investigate during PM.',
        assignedTechId: jasmin._id.toString(), assignedTechName: 'Jasmin Torres',
        createdBy: david._id.toString() },

      // ── IN PROGRESS — Tech actively working ──
      { woNumber: 'WO-2026-0210-0001', type: 'WO', formType: 'WO',
        companyId: cid, clientId: clients[0]._id.toString(),
        accountNumber: 'MG-1001', clientName: 'Mercy General Hospital',
        assetId: assets[8]._id.toString(), serialNumber: 'SN-PHI-009',
        model: 'IntelliVue MX40', skill: 'Specialty', woType: 'Repair',
        status: 'Active', subStatus: 'In Progress', emergency: false,
        contact: 'Dr. Amanda Foster', phone: '(555) 100-1001',
        email: 'biomed@mercygeneral.com', site: 'East Wing',
        building: 'E', location: 'Tele Room 2',
        customerIssue: 'Wearable telemetry unit not holding charge beyond 2 hours. Battery replacement needed.',
        woNotes: 'Opened unit. Battery swollen — ordering replacement from Philips. ETA 3 days.',
        assignedTechId: carlos._id.toString(), assignedTechName: 'Carlos Rivera',
        createdBy: sarah._id.toString(),
        timeEntries: [
          { techId: carlos._id.toString(), techName: 'Carlos Rivera', type: 'labor',
            clockIn: d(2, 9), clockOut: d(2, 10, 30), duration: 1.5, billable: true },
        ] },

      // ── COMPLETED — Awaiting office review ──
      { woNumber: 'WO-2026-0201-0001', type: 'PM', formType: 'PM',
        companyId: cid, clientId: clients[1]._id.toString(),
        accountNumber: 'SL-2002', clientName: 'St. Luke\'s Medical Center',
        assetId: assets[1]._id.toString(), serialNumber: 'SN-PHI-002',
        model: 'IntelliVue MX800', skill: 'Specialty', woType: 'PM Inspection',
        status: 'Completed', subStatus: 'Awaiting Review', emergency: false,
        contact: 'James Wheeler', phone: '(555) 200-2002',
        email: 'biomed@stlukes.com', site: 'Surgery Center',
        building: 'B', location: 'OR-3',
        customerIssue: 'Quarterly PM inspection due.',
        woNotes: 'All parameters within spec. Replaced NIBP hose. Display cleaned. Alarm test passed all channels.',
        assignedTechId: aiden._id.toString(), assignedTechName: 'Aiden Park',
        createdBy: sarah._id.toString(),
        procedures: [
          { step: 'Visual inspection — enclosure, cables, connectors', result: 'PASS', critical: false },
          { step: 'Power-on self-test (POST)', result: 'PASS', critical: false },
          { step: 'Alarm test — all channels', result: 'PASS', critical: true },
          { step: 'SpO2 accuracy (±2%)', result: 'PASS', critical: true },
          { step: 'NIBP accuracy (±3mmHg)', result: 'PASS', critical: true },
          { step: 'ECG waveform quality', result: 'PASS', critical: false },
          { step: 'Temperature probe test', result: 'PASS', critical: false },
          { step: 'Electrical safety — leakage current', result: 'PASS', critical: true },
        ],
        timeEntries: [
          { techId: aiden._id.toString(), techName: 'Aiden Park', type: 'labor',
            clockIn: d(5, 9), clockOut: d(5, 11), duration: 2, billable: true },
          { techId: aiden._id.toString(), techName: 'Aiden Park', type: 'travel',
            clockIn: d(5, 8), clockOut: d(5, 8, 45), duration: 0.75, billable: true },
        ],
        partsUsed: [
          { name: 'NIBP Hose (Adult)', sku: 'NIBP-H-300', qty: 1, unitPrice: 35.00, addedAt: d(5) },
        ],
        rating: { score: 5, comment: 'Aiden was thorough and professional.', ratedAt: d(4) },
      },

      { woNumber: 'WO-2026-0215-0001', type: 'WO', formType: 'WO',
        companyId: cid, clientId: clients[0]._id.toString(),
        accountNumber: 'MG-1001', clientName: 'Mercy General Hospital',
        assetId: assets[3]._id.toString(), serialNumber: 'SN-ZOL-004',
        model: 'R Series', skill: 'Specialty', woType: 'Repair',
        status: 'Completed', subStatus: 'Awaiting Review', emergency: false,
        contact: 'Dr. Amanda Foster', phone: '(555) 100-1001',
        email: 'biomed@mercygeneral.com', site: 'Main Campus',
        building: 'A', location: 'ER Bay 1',
        customerIssue: 'Defibrillator energy delivery inconsistent. Self-test showing pad connection warning.',
        woNotes: 'Replaced defibrillator pads and internal pad connector cable. Energy delivery test: 150J, 200J, 300J, 360J — all within spec. Recommend replacing battery within 6 months.',
        assignedTechId: carlos._id.toString(), assignedTechName: 'Carlos Rivera',
        createdBy: sarah._id.toString(),
        timeEntries: [
          { techId: carlos._id.toString(), techName: 'Carlos Rivera', type: 'labor',
            clockIn: d(7, 10), clockOut: d(7, 12, 30), duration: 2.5, billable: true },
        ],
        partsUsed: [
          { name: 'Defibrillator Pads (Adult)', sku: 'DEF-PAD-400', qty: 2, unitPrice: 55.00, addedAt: d(7) },
        ] },

      // ── BILLED — Sent to client, awaiting payment ──
      { woNumber: 'WO-2026-0120-0001', type: 'PM', formType: 'PM',
        companyId: cid, clientId: clients[2]._id.toString(),
        accountNumber: 'VC-3003', clientName: 'Valley Children\'s Hospital',
        assetId: assets[10]._id.toString(), serialNumber: 'SN-MIN-011',
        model: 'Puritan Bennett 980', skill: 'Specialty', woType: 'PM Inspection',
        status: 'Completed', subStatus: 'Billed', emergency: false,
        contact: 'Rosa Martinez', phone: '(555) 300-3003',
        email: 'biomed@valleychildrens.com', site: 'Pediatric Wing',
        building: 'F', location: 'PICU 3',
        customerIssue: 'Quarterly PM on pediatric ventilator.',
        woNotes: 'Full PM completed. All 8 procedures passed. Replaced flow sensor (preventive).',
        assignedTechId: aiden._id.toString(), assignedTechName: 'Aiden Park',
        createdBy: sarah._id.toString(),
        procedures: [
          { step: 'Visual inspection', result: 'PASS', critical: false },
          { step: 'Leak test (circuit)', result: 'PASS', critical: true },
          { step: 'Tidal volume accuracy', result: 'PASS', critical: true },
          { step: 'FiO2 sensor calibration', result: 'PASS', critical: true },
          { step: 'Alarm limits test', result: 'PASS', critical: true },
          { step: 'Battery backup test', result: 'PASS', critical: true },
          { step: 'Patient circuit test', result: 'PASS', critical: false },
          { step: 'Electrical safety', result: 'PASS', critical: true },
        ],
        timeEntries: [
          { techId: aiden._id.toString(), techName: 'Aiden Park', type: 'labor',
            clockIn: d(14, 8), clockOut: d(14, 10, 45), duration: 2.75, billable: true },
        ],
        partsUsed: [
          { name: 'Ventilator Flow Sensor', sku: 'VENT-FS-900', qty: 1, unitPrice: 110.00, addedAt: d(14) },
        ],
        rating: { score: 5, comment: 'Excellent preventive maintenance. Very thorough.', ratedAt: d(13) },
      },

      // ── ARCHIVED — Fully closed ──
      { woNumber: 'WO-2026-0105-0001', type: 'WO', formType: 'WO',
        companyId: cid, clientId: clients[0]._id.toString(),
        accountNumber: 'MG-1001', clientName: 'Mercy General Hospital',
        assetId: assets[0]._id.toString(), serialNumber: 'SN-GE-001',
        model: 'Carescape B650', skill: 'Specialty', woType: 'Repair',
        status: 'Archived', subStatus: 'Closed', emergency: false,
        contact: 'Dr. Amanda Foster', phone: '(555) 100-1001',
        email: 'biomed@mercygeneral.com', site: 'Main Campus',
        building: 'A', location: 'Room 401',
        customerIssue: 'ECG module not reading leads properly. Waveform artifacts on lead II.',
        woNotes: 'Replaced ECG lead wire set and cleaned module contacts. All 12 leads verified. Issue resolved.',
        assignedTechId: mike._id.toString(), assignedTechName: 'Mike Thompson',
        createdBy: sarah._id.toString(), sentToArchive: true,
        timeEntries: [
          { techId: mike._id.toString(), techName: 'Mike Thompson', type: 'labor',
            clockIn: d(30, 13), clockOut: d(30, 14, 45), duration: 1.75, billable: true },
        ],
        partsUsed: [
          { name: 'ECG Lead Wire Set', sku: 'ECG-LW-200', qty: 1, unitPrice: 65.00, addedAt: d(30) },
        ],
        rating: { score: 4, comment: 'Fixed the issue. Took a bit longer than expected.', ratedAt: d(29) },
      },

      { woNumber: 'WO-2026-0110-0001', type: 'PM', formType: 'PM',
        companyId: cid, clientId: clients[1]._id.toString(),
        accountNumber: 'SL-2002', clientName: 'St. Luke\'s Medical Center',
        assetId: assets[9]._id.toString(), serialNumber: 'SN-MAS-010',
        model: 'Radical-7', skill: 'Basic/General', woType: 'PM Inspection',
        status: 'Archived', subStatus: 'Closed', emergency: false,
        contact: 'James Wheeler', phone: '(555) 200-2002',
        email: 'biomed@stlukes.com', site: 'Surgery Center',
        building: 'B', location: 'PACU Bay 4',
        customerIssue: 'Semi-annual PM on Masimo oximeter.',
        woNotes: 'Calibration confirmed. SpO2 readings within ±1%. All tests passed.',
        assignedTechId: jasmin._id.toString(), assignedTechName: 'Jasmin Torres',
        createdBy: david._id.toString(), sentToArchive: true,
        procedures: [
          { step: 'Visual inspection', result: 'PASS', critical: false },
          { step: 'SpO2 accuracy check', result: 'PASS', critical: true },
          { step: 'Alarm test', result: 'PASS', critical: true },
          { step: 'Electrical safety', result: 'PASS', critical: true },
        ],
        timeEntries: [
          { techId: jasmin._id.toString(), techName: 'Jasmin Torres', type: 'labor',
            clockIn: d(25, 10), clockOut: d(25, 11), duration: 1, billable: true },
        ] },

      // ── CALLBACK — Return visit ──
      { woNumber: 'WO-2026-0304-0001', type: 'WO', formType: 'WO',
        companyId: cid, clientId: clients[0]._id.toString(),
        accountNumber: 'MG-1001', clientName: 'Mercy General Hospital',
        assetId: assets[0]._id.toString(), serialNumber: 'SN-GE-001',
        model: 'Carescape B650', skill: 'Specialty', woType: 'Callback',
        status: 'Active', subStatus: 'Dispatched', emergency: false,
        contact: 'Dr. Amanda Foster', phone: '(555) 100-1001',
        email: 'biomed@mercygeneral.com', site: 'Main Campus',
        building: 'A', location: 'Room 401',
        customerIssue: 'CALLBACK: Same SpO2 issue from WO-2026-0301-0001 returned after 2 days. Module may need full replacement.',
        assignedTechId: carlos._id.toString(), assignedTechName: 'Carlos Rivera',
        createdBy: sarah._id.toString() },
    ]);
    console.log(`📋 Created ${workOrders.length} work orders`);

    // ═══════════════════════════════════════════════════════
    //  6. INVENTORY — 15 items with low-stock alerts
    // ═══════════════════════════════════════════════════════
    const inventory = await Inventory.insertMany([
      { companyId: cid, name: 'SpO2 Sensor (Adult Reusable)', sku: 'SPO2-AR-100', category: 'Patient Monitoring', quantity: 12, minQuantity: 5, cost: 45, sellPrice: 89, vendor: 'Nellcor', manufacturer: 'Medtronic' },
      { companyId: cid, name: 'ECG Lead Wire Set', sku: 'ECG-LW-200', category: 'Patient Monitoring', quantity: 2, minQuantity: 3, cost: 32, sellPrice: 65, vendor: 'Philips Medical', manufacturer: 'Philips' },
      { companyId: cid, name: 'NIBP Hose (Adult)', sku: 'NIBP-H-300', category: 'Patient Monitoring', quantity: 15, minQuantity: 5, cost: 18, sellPrice: 35, vendor: 'SunTech', manufacturer: 'SunTech' },
      { companyId: cid, name: 'Defibrillator Pads (Adult)', sku: 'DEF-PAD-400', category: 'Diagnostic', quantity: 4, minQuantity: 10, cost: 25, sellPrice: 55, vendor: 'ZOLL Medical', manufacturer: 'ZOLL' },
      { companyId: cid, name: 'IV Pump Tubing Set', sku: 'IV-TS-500', category: 'General', quantity: 30, minQuantity: 10, cost: 8.5, sellPrice: 18, vendor: 'Baxter', manufacturer: 'Baxter' },
      { companyId: cid, name: 'Anesthesia Vaporizer O-Ring Kit', sku: 'ANES-OR-600', category: 'Surgical', quantity: 6, minQuantity: 3, cost: 12, sellPrice: 28, vendor: 'Dräger', manufacturer: 'Dräger' },
      { companyId: cid, name: 'Autoclave Gasket (Large)', sku: 'AUTO-G-700', category: 'Sterilization', quantity: 1, minQuantity: 2, cost: 85, sellPrice: 165, vendor: 'Getinge', manufacturer: 'Getinge' },
      { companyId: cid, name: 'Fiber Optic Cable (Endoscopy)', sku: 'FOC-12', category: 'Imaging', quantity: 3, minQuantity: 2, cost: 120, sellPrice: 245, vendor: 'Olympus', manufacturer: 'Olympus' },
      { companyId: cid, name: 'Ventilator Flow Sensor', sku: 'VENT-FS-900', category: 'Respiratory', quantity: 7, minQuantity: 3, cost: 55, sellPrice: 110, vendor: 'Hamilton', manufacturer: 'Hamilton' },
      { companyId: cid, name: 'Battery Pack (Defibrillator)', sku: 'BAT-DEF-1000', category: 'Diagnostic', quantity: 5, minQuantity: 3, cost: 180, sellPrice: 350, vendor: 'Physio-Control', manufacturer: 'Stryker' },
      { companyId: cid, name: 'Fuse Kit (Assorted)', sku: 'FK-AST', category: 'Electrical', quantity: 20, minQuantity: 5, cost: 3.5, sellPrice: 8, vendor: 'Eaton', manufacturer: 'Eaton', vanTechId: carlos._id.toString() },
      { companyId: cid, name: '2.5mm Catheter Lead', sku: 'CL-250', category: 'Patient Monitoring', quantity: 4, minQuantity: 2, cost: 15, sellPrice: 32, vendor: 'Philips', manufacturer: 'Philips', vanTechId: carlos._id.toString() },
      { companyId: cid, name: 'Endoscope Light Bulb', sku: 'ENDO-LB-13', category: 'Imaging', quantity: 1, minQuantity: 2, cost: 95, sellPrice: 190, vendor: 'Stryker', manufacturer: 'Stryker' },
      { companyId: cid, name: 'Temperature Probe (Skin)', sku: 'TEMP-SK-14', category: 'Patient Monitoring', quantity: 8, minQuantity: 4, cost: 22, sellPrice: 45, vendor: 'Philips', manufacturer: 'Philips' },
      { companyId: cid, name: 'Printer Paper (Monitor)', sku: 'PPR-MON-15', category: 'General', quantity: 25, minQuantity: 10, cost: 4, sellPrice: 9, vendor: 'Sony', manufacturer: 'Sony' },
    ]);
    console.log(`📦 Created ${inventory.length} inventory items`);

    // ═══════════════════════════════════════════════════════
    //  7. NOTIFICATIONS — recent activity
    // ═══════════════════════════════════════════════════════
    try {
      await Notification.insertMany([
        { companyId: cid, userId: sarah._id.toString(), type: 'emergency', title: '🚨 Emergency WO Created',
          message: 'George Hall submitted emergency WO for Stryker Endoscopy Tower — Summit Clinic',
          read: false, createdAt: d(0, 14) },
        { companyId: cid, userId: sarah._id.toString(), type: 'wo_update', title: 'WO Status Updated',
          message: 'Carlos Rivera updated WO-2026-0210-0001 status to In Progress (GE Carescape • Riverside)',
          read: false, createdAt: d(2, 9, 15) },
        { companyId: cid, userId: carlos._id.toString(), type: 'assignment', title: 'New WO Assigned',
          message: 'You have been assigned WO-2026-0305-0001 — Hamilton C6 ventilator PM at Mercy General',
          read: false, createdAt: d(3, 8) },
        { companyId: cid, userId: sarah._id.toString(), type: 'wo_complete', title: '✅ PM Completed',
          message: 'Aiden Park closed PM on Philips IntelliVue MX800 — all 8 procedures passed',
          read: true, createdAt: d(5, 11, 30) },
        { companyId: cid, userId: sarah._id.toString(), type: 'inventory_alert', title: '⚠️ Low Stock Alert',
          message: 'Defibrillator Pads (DEF-PAD-400): 4 remaining, minimum is 10',
          read: false, createdAt: d(1, 7) },
        { companyId: cid, userId: sarah._id.toString(), type: 'inventory_alert', title: '⚠️ Low Stock Alert',
          message: 'ECG Lead Wire Set (ECG-LW-200): 2 remaining, minimum is 3',
          read: false, createdAt: d(1, 7) },
      ]);
      console.log('🔔 Created 6 notifications');
    } catch { console.log('⚠️  Notifications skipped (model not available)'); }

    // ═══════════════════════════════════════════════════════
    //  SUMMARY
    // ═══════════════════════════════════════════════════════
    const lowStock = inventory.filter(i => i.quantity <= i.minQuantity);
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  ✅ FULL SEED COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  🏢 1 Company (Enterprise tier)`);
    console.log(`  👥 ${users.length} Users`);
    console.log(`  🏥 ${clients.length} Clients`);
    console.log(`  🔧 ${assets.length} Assets`);
    console.log(`  📋 ${workOrders.length} Work Orders`);
    console.log(`  📦 ${inventory.length} Inventory Items (${lowStock.length} LOW STOCK)`);
    console.log(`  🔔 6 Notifications`);
    console.log('═══════════════════════════════════════════════════');
    console.log('\n📋 WORK ORDER STATUS DISTRIBUTION:');
    console.log('  🟡 Pending/Unscheduled:  2 (dispatch queue)');
    console.log('  🔴 Emergency/Unscheduled: 3 (URGENT dispatch)');
    console.log('  🔵 Dispatched:           2 (assigned, not started)');
    console.log('  🟠 In Progress:          1 (tech working)');
    console.log('  🟢 Completed/Review:     2 (office review)');
    console.log('  💵 Billed:               1 (sent to client)');
    console.log('  📁 Archived:             2 (fully closed)');
    console.log('  🔄 Callback:             1 (return visit)');
    console.log('  ─────────────────────────');
    console.log('  TOTAL:                   15 work orders');
    console.log(`\n⚠️  LOW STOCK ALERTS: ${lowStock.length} items`);
    lowStock.forEach(i => console.log(`    ${i.name}: ${i.quantity}/${i.minQuantity}`));
    console.log('\n═══════════════════════════════════════════════════');
    console.log('LOGIN ACCOUNTS:');
    console.log('═══════════════════════════════════════════════════');
    console.log('  Platform Owner:');
    console.log('    jason@technical-made-easy.com / TechnicalTeamFirst4388');
    console.log('\n  All other accounts use password: TechnicalTeamFirst4388');
    users.filter(u => u.role !== 'OWNER').forEach(u =>
      console.log(`    ${u.role.padEnd(8)} ${u.name.padEnd(22)} → ${u.email}`)
    );
    console.log('═══════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed Error:', err);
    process.exit(1);
  }
}

seed();
