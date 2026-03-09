#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
//  FULL SYSTEM SEED — Realistic Data for Manual Testing
//  Technical Made Easy
//
//  Creates: Users, Clients, Work Orders, Assets, Inventory
//
//  Usage:
//    node seed-full.js              (seed everything)
//    node seed-full.js --reset      (drop ALL collections first)
//
//  HIPAA Note: This is TEST DATA ONLY — no real PHI.
// ═══════════════════════════════════════════════════════════════════

require('dotenv').config();
const mongoose = require('mongoose');
const User      = require('./models/User');
const Client    = require('./models/Client');
const WorkOrder = require('./models/WorkOrder');
const Asset     = require('./models/Asset');
const Inventory = require('./models/Inventory');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('❌ MONGO_URI not in .env'); process.exit(1); }

const RESET = process.argv.includes('--reset');

// ── Helper: random date ──
function daysAgo(n) { return new Date(Date.now() - n * 24 * 60 * 60 * 1000); }
function hoursAgo(n) { return new Date(Date.now() - n * 60 * 60 * 1000); }

async function seed() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  FULL SYSTEM SEED — Test Data Generator');
  console.log('═══════════════════════════════════════════════════\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  if (RESET) {
    console.log('⚠️  --reset: Dropping all data...');
    await Promise.all([
      Client.deleteMany({}),
      WorkOrder.deleteMany({}),
      Asset.deleteMany({}),
      Inventory.deleteMany({}),
    ]);
    console.log('✅ Collections cleared\n');
  }

  // ── 1. Ensure Users exist ──
  console.log('👥 Checking users...');
  const ownerUser = await User.findOne({ email: 'Tappout360' });
  if (!ownerUser) {
    console.log('   ⚠️  No PLATFORM_OWNER found — run `node seed.js` first!');
    await mongoose.disconnect();
    process.exit(1);
  }
  const rachUser = await User.findOne({ email: 'rachel@biomedicorp.com' });
  const carlosUser = await User.findOne({ email: 'carlos@biomedicorp.com' });
  const sarahUser  = await User.findOne({ email: 'sarah@biomedicorp.com' });
  const tomUser    = await User.findOne({ email: 'tom@medserv.com' });
  const jamesUser  = await User.findOne({ email: 'james@medserv.com' });

  const companyId1 = 'c1'; // BiomediCorp
  const companyId2 = 'c2'; // MedServ Solutions
  console.log('   ✅ Users verified\n');

  // ── 2. CLIENTS ──
  console.log('🏥 Seeding clients...');
  const clientData = [
    {
      accountNumber: 'TME-CL-0001',
      name: 'Memorial General Hospital',
      contactName: 'Dr. Patricia Williams',
      phone: '(555) 100-1000',
      email: 'pwilliams@memorial-gen.org',
      address: '1200 Medical Center Dr, Atlanta, GA 30322',
      sites: ['Main Campus', 'East Wing', 'West Wing', 'Surgical Center'],
      companyId: companyId1,
      userId: rachUser?._id?.toString() || 'system',
      status: 'active',
      rating: 5,
      healthScore: 92,
      coveredAssetCount: 45,
      contracts: [{
        contractNumber: 'CON-2025-001',
        type: 'Full-Service',
        startDate: daysAgo(365),
        endDate: daysAgo(-365),
        billingRate: 95,
        monthlyFee: 4500,
        autoRenew: true,
        status: 'active',
        notes: 'Includes all biomedical equipment PM and corrective maintenance',
      }],
      slaPolicy: {
        criticalResponse: 1, criticalResolution: 4,
        highResponse: 2, highResolution: 12,
        normalResponse: 4, normalResolution: 48,
        lowResponse: 8, lowResolution: 120,
      },
    },
    {
      accountNumber: 'TME-CL-0002',
      name: 'St. Luke Medical Center',
      contactName: 'Karen Mitchell',
      phone: '(555) 200-2000',
      email: 'kmitchell@stluke-med.org',
      address: '800 Healthcare Blvd, Marietta, GA 30060',
      sites: ['Main Building', 'Outpatient Clinic'],
      companyId: companyId1,
      userId: rachUser?._id?.toString() || 'system',
      status: 'active',
      rating: 4,
      healthScore: 85,
      coveredAssetCount: 22,
      contracts: [{
        contractNumber: 'CON-2025-002',
        type: 'PM',
        startDate: daysAgo(200),
        endDate: daysAgo(-165),
        billingRate: 85,
        monthlyFee: 2200,
        autoRenew: true,
        status: 'active',
      }],
    },
    {
      accountNumber: 'TME-CL-0003',
      name: 'Peachtree Surgical Center',
      contactName: 'Dr. Robert Chen',
      phone: '(555) 300-3000',
      email: 'rchen@peachtree-surg.com',
      address: '450 Peachtree St NE, Atlanta, GA 30308',
      sites: ['Surgical Suite A', 'Surgical Suite B', 'Recovery'],
      companyId: companyId1,
      userId: rachUser?._id?.toString() || 'system',
      status: 'active',
      rating: 5,
      healthScore: 98,
      coveredAssetCount: 18,
      contracts: [{
        contractNumber: 'CON-2025-003',
        type: 'Full-Service',
        startDate: daysAgo(90),
        endDate: daysAgo(-275),
        billingRate: 110,
        monthlyFee: 3800,
        autoRenew: true,
        status: 'active',
      }],
    },
    {
      accountNumber: 'TME-CL-0004',
      name: 'Valley Dialysis Network',
      contactName: 'Angela Foster',
      phone: '(555) 400-4000',
      email: 'afoster@valleydialysis.com',
      address: '2100 Valley Rd, Decatur, GA 30030',
      sites: ['Center 1 - Decatur', 'Center 2 - Stone Mountain', 'Center 3 - Lithonia'],
      companyId: companyId2,
      userId: tomUser?._id?.toString() || 'system',
      status: 'active',
      rating: 4,
      healthScore: 78,
      coveredAssetCount: 30,
    },
    {
      accountNumber: 'TME-CL-0005',
      name: 'Northside Pediatric Hospital',
      contactName: 'Dr. Maria Santos',
      phone: '(555) 500-5000',
      email: 'msantos@northside-peds.org',
      address: '3200 Hospital Way, Roswell, GA 30076',
      sites: ['Pediatric ICU', 'NICU', 'General Pediatrics'],
      companyId: companyId2,
      userId: tomUser?._id?.toString() || 'system',
      status: 'active',
      rating: 5,
      healthScore: 95,
      coveredAssetCount: 35,
    },
  ];

  let clientsCreated = 0;
  for (const c of clientData) {
    const exists = await Client.findOne({ accountNumber: c.accountNumber });
    if (!exists) { await Client.create(c); clientsCreated++; }
  }
  console.log(`   ✅ ${clientsCreated} clients created (${clientData.length - clientsCreated} already existed)\n`);

  // ── 3. ASSETS ──
  console.log('🔩 Seeding assets...');
  const assetData = [
    // Memorial Hospital assets
    { qrTag: 'QR-MEM-001', serialNumber: 'SN-GE-B450-001', model: 'B450', manufacturer: 'GE Healthcare', department: 'ICU', site: 'Main Campus', building: 'East Wing', location: 'Room 401', status: 'operational', companyId: companyId1, clientId: 'TME-CL-0001', pmFrequency: 'Annual', pmDueDate: daysAgo(-30) },
    { qrTag: 'QR-MEM-002', serialNumber: 'SN-PH-MX800-001', model: 'IntelliVue MX800', manufacturer: 'Philips', department: 'ICU', site: 'Main Campus', building: 'East Wing', location: 'Room 402', status: 'operational', companyId: companyId1, clientId: 'TME-CL-0001', pmFrequency: 'Annual', pmDueDate: daysAgo(-15) },
    { qrTag: 'QR-MEM-003', serialNumber: 'SN-DR-V500-001', model: 'Evita V500', manufacturer: 'Drager', department: 'ICU', site: 'Main Campus', building: 'East Wing', location: 'Room 403', status: 'operational', companyId: companyId1, clientId: 'TME-CL-0001', pmFrequency: 'Semi-Annual', pmDueDate: daysAgo(-45) },
    { qrTag: 'QR-MEM-004', serialNumber: 'SN-BX-SS-001', model: 'Sigma Spectrum', manufacturer: 'Baxter', department: 'Med/Surg', site: 'Main Campus', building: 'West Wing', location: 'Room 201', status: 'operational', companyId: companyId1, clientId: 'TME-CL-0001', pmFrequency: 'Annual', pmDueDate: daysAgo(10) },
    { qrTag: 'QR-MEM-005', serialNumber: 'SN-ST-V116-001', model: 'V116', manufacturer: 'Steris', department: 'Sterile Processing', site: 'Main Campus', building: 'Surgical Center', location: 'SPD Room 1', status: 'operational', companyId: companyId1, clientId: 'TME-CL-0001', pmFrequency: 'Quarterly', pmDueDate: daysAgo(-7) },
    { qrTag: 'QR-MEM-006', serialNumber: 'SN-GE-DEFIB-001', model: 'MAC VU360', manufacturer: 'GE Healthcare', department: 'Cardiology', site: 'Main Campus', building: 'East Wing', location: 'Room 310', status: 'needs-repair', companyId: companyId1, clientId: 'TME-CL-0001', pmFrequency: 'Annual', pmDueDate: daysAgo(60) },
    // St. Luke assets
    { qrTag: 'QR-STL-001', serialNumber: 'SN-PH-VM6-001', model: 'SureSigns VM6', manufacturer: 'Philips', department: 'Emergency', site: 'Main Building', building: 'ER', location: 'Bay 1', status: 'operational', companyId: companyId1, clientId: 'TME-CL-0002', pmFrequency: 'Annual', pmDueDate: daysAgo(-20) },
    { qrTag: 'QR-STL-002', serialNumber: 'SN-BX-PUMP-002', model: 'Sigma Spectrum IQ', manufacturer: 'Baxter', department: 'Infusion Therapy', site: 'Main Building', building: 'Floor 2', location: 'Nurse Station B', status: 'operational', companyId: companyId1, clientId: 'TME-CL-0002', pmFrequency: 'Annual', pmDueDate: daysAgo(5) },
    // Peachtree assets
    { qrTag: 'QR-PT-001', serialNumber: 'SN-SI-MRI-001', model: 'MAGNETOM Vida 3T', manufacturer: 'Siemens Healthineers', department: 'Radiology', site: 'Surgical Suite A', building: 'MRI Suite', location: 'Room MR-1', status: 'operational', companyId: companyId1, clientId: 'TME-CL-0003', pmFrequency: 'Annual', pmDueDate: daysAgo(-90) },
    { qrTag: 'QR-PT-002', serialNumber: 'SN-OL-SCOPE-001', model: 'CV-190', manufacturer: 'Olympus', department: 'Endoscopy', site: 'Surgical Suite B', building: 'Endo Suite', location: 'Procedure Room 1', status: 'operational', companyId: companyId1, clientId: 'TME-CL-0003', pmFrequency: 'Semi-Annual', pmDueDate: daysAgo(-10) },
    // Valley Dialysis
    { qrTag: 'QR-VD-001', serialNumber: 'SN-FMC-5008S-001', model: '5008S', manufacturer: 'Fresenius', department: 'Dialysis', site: 'Center 1 - Decatur', building: 'Main', location: 'Station 1', status: 'operational', companyId: companyId2, clientId: 'TME-CL-0004', pmFrequency: 'Monthly', pmDueDate: daysAgo(-3) },
    { qrTag: 'QR-VD-002', serialNumber: 'SN-FMC-5008S-002', model: '5008S', manufacturer: 'Fresenius', department: 'Dialysis', site: 'Center 1 - Decatur', building: 'Main', location: 'Station 2', status: 'needs-repair', companyId: companyId2, clientId: 'TME-CL-0004', pmFrequency: 'Monthly', pmDueDate: daysAgo(5) },
    // Northside Pediatric
    { qrTag: 'QR-NP-001', serialNumber: 'SN-DR-BW-001', model: 'Babylog VN600', manufacturer: 'Drager', department: 'NICU', site: 'Pediatric ICU', building: 'NICU Wing', location: 'Bed 1', status: 'operational', companyId: companyId2, clientId: 'TME-CL-0005', pmFrequency: 'Semi-Annual', pmDueDate: daysAgo(-30) },
    { qrTag: 'QR-NP-002', serialNumber: 'SN-PH-MX550-001', model: 'IntelliVue MX550', manufacturer: 'Philips', department: 'NICU', site: 'Pediatric ICU', building: 'NICU Wing', location: 'Bed 2', status: 'operational', companyId: companyId2, clientId: 'TME-CL-0005', pmFrequency: 'Annual', pmDueDate: daysAgo(-60) },
  ];

  let assetsCreated = 0;
  for (const a of assetData) {
    const exists = await Asset.findOne({ qrTag: a.qrTag });
    if (!exists) { await Asset.create(a); assetsCreated++; }
  }
  console.log(`   ✅ ${assetsCreated} assets created\n`);

  // ── 4. WORK ORDERS — Various statuses for full lifecycle testing ──
  console.log('📋 Seeding work orders...');
  const carlosId = carlosUser?._id?.toString() || 'tech1';
  const sarahId  = sarahUser?._id?.toString()  || 'tech2';
  const jamesId  = jamesUser?._id?.toString()  || 'tech3';
  const createdBy = rachUser?._id?.toString()   || 'admin1';

  const woData = [
    // Active/Dispatched WOs (show on dispatch board)
    {
      woNumber: 'WO-2026-0308-001', type: 'WO', companyId: companyId1,
      clientId: 'TME-CL-0001', clientName: 'Memorial General Hospital',
      serialNumber: 'SN-GE-DEFIB-001', model: 'MAC VU360', manufacturer: 'GE Healthcare',
      status: 'Active', subStatus: 'Dispatched', priority: 'high', emergency: false,
      assignedTechId: carlosId, assignedTechName: 'Carlos Reyes',
      contact: 'Dr. Patricia Williams', phone: '(555) 100-1000',
      site: 'Main Campus', building: 'East Wing', location: 'Room 310',
      customerIssue: 'ECG waveform showing intermittent artifact on leads II and V1. Display freezes for 2-3 seconds. Unit was recently moved from Cardiology to ICU.',
      woNotes: 'Check ECG lead connections and run full diagnostic. May need firmware update.',
      skill: 'biomedical', createdBy, createdAt: hoursAgo(6),
    },
    {
      woNumber: 'WO-2026-0308-002', type: 'PM', companyId: companyId1,
      clientId: 'TME-CL-0001', clientName: 'Memorial General Hospital',
      serialNumber: 'SN-ST-V116-001', model: 'V116', manufacturer: 'Steris',
      status: 'Active', subStatus: 'Dispatched', priority: 'normal',
      assignedTechId: sarahId, assignedTechName: 'Sarah Chen',
      contact: 'Dr. Patricia Williams', phone: '(555) 100-1000',
      site: 'Main Campus', building: 'Surgical Center', location: 'SPD Room 1',
      customerIssue: 'Quarterly preventive maintenance on autoclave. Last PM completed 3 months ago. Include biological indicator test.',
      skill: 'sterilization', createdBy, createdAt: hoursAgo(4),
    },
    {
      woNumber: 'WO-2026-0308-003', type: 'WO', companyId: companyId1,
      clientId: 'TME-CL-0002', clientName: 'St. Luke Medical Center',
      serialNumber: 'SN-BX-PUMP-002', model: 'Sigma Spectrum IQ', manufacturer: 'Baxter',
      status: 'Active', subStatus: 'Unscheduled', priority: 'normal',
      contact: 'Karen Mitchell', phone: '(555) 200-2000',
      site: 'Main Building', building: 'Floor 2', location: 'Nurse Station B',
      customerIssue: 'Infusion pump displaying E-042 air-in-line alarm repeatedly. Already replaced tubing set. Cleaned sensor window but alarm keeps triggering.',
      skill: 'biomedical', createdBy, createdAt: hoursAgo(2),
    },
    {
      woNumber: 'WO-2026-0308-004', type: 'WO', companyId: companyId1,
      clientId: 'TME-CL-0003', clientName: 'Peachtree Surgical Center',
      serialNumber: 'SN-OL-SCOPE-001', model: 'CV-190', manufacturer: 'Olympus',
      status: 'Active', subStatus: 'Unscheduled', priority: 'high', emergency: true,
      contact: 'Dr. Robert Chen', phone: '(555) 300-3000',
      site: 'Surgical Suite B', building: 'Endo Suite', location: 'Procedure Room 1',
      customerIssue: 'URGENT — Endoscopy processor showing image quality degradation. Cases scheduled for tomorrow morning. Need this resolved today.',
      skill: 'endoscopy', createdBy, createdAt: hoursAgo(1),
    },
    // Completed WOs (show in WO Control Board)
    {
      woNumber: 'WO-2026-0305-001', type: 'WO', companyId: companyId1,
      clientId: 'TME-CL-0001', clientName: 'Memorial General Hospital',
      serialNumber: 'SN-GE-B450-001', model: 'B450', manufacturer: 'GE Healthcare',
      status: 'Completed', subStatus: 'Send Report', priority: 'normal',
      assignedTechId: carlosId, assignedTechName: 'Carlos Reyes',
      contact: 'Dr. Patricia Williams', phone: '(555) 100-1000',
      site: 'Main Campus', building: 'East Wing', location: 'Room 401',
      customerIssue: 'Annual PM on patient monitor. All parameters need verification: SpO2, NIBP, ECG, Temp.',
      woNotes: 'All tests passed. SpO2 within 1%. NIBP within 2mmHg. ECG clean. Battery holds 4hrs. Updated firmware to v3.2.',
      skill: 'biomedical', createdBy, createdAt: daysAgo(3),
      timeEntries: [{
        techId: carlosId, techName: 'Carlos Reyes', type: 'labor',
        clockIn: new Date(daysAgo(3).getTime() + 8*3600000),
        clockOut: new Date(daysAgo(3).getTime() + 10*3600000),
        duration: 2, billable: true,
      }],
      partsUsed: [{
        name: 'SpO2 Finger Probe', sku: 'SPO2-FP-100', qty: 1, unitPrice: 35,
      }],
      billingRate: 95, invoiceTotal: 225,
    },
    {
      woNumber: 'WO-2026-0304-001', type: 'PM', companyId: companyId1,
      clientId: 'TME-CL-0001', clientName: 'Memorial General Hospital',
      serialNumber: 'SN-DR-V500-001', model: 'Evita V500', manufacturer: 'Drager',
      status: 'Completed', subStatus: 'Send Report', priority: 'high',
      assignedTechId: sarahId, assignedTechName: 'Sarah Chen',
      contact: 'Dr. Patricia Williams', phone: '(555) 100-1000',
      site: 'Main Campus', building: 'East Wing', location: 'Room 403',
      customerIssue: 'Semi-annual PM on ventilator. O2 sensor due for replacement.',
      woNotes: 'Replaced O2 sensor (old cell reading 19.2%). New cell calibrated to 20.9%. All alarms verified. Self-test passed. Flow sensor cleaned. Battery holds 45 min under load.',
      skill: 'biomedical', createdBy, createdAt: daysAgo(4),
      timeEntries: [{
        techId: sarahId, techName: 'Sarah Chen', type: 'labor',
        clockIn: new Date(daysAgo(4).getTime() + 9*3600000),
        clockOut: new Date(daysAgo(4).getTime() + 12.5*3600000),
        duration: 3.5, billable: true,
      }],
      partsUsed: [
        { name: 'O2 Sensor Cell', sku: 'O2S-DRG-V500', qty: 1, unitPrice: 60 },
        { name: 'HEPA Filter', sku: 'HEPA-DRG-001', qty: 1, unitPrice: 25 },
      ],
      billingRate: 95, invoiceTotal: 417.50,
    },
    // Invoiced WO (awaiting payment)
    {
      woNumber: 'WO-2026-0301-001', type: 'WO', companyId: companyId1,
      clientId: 'TME-CL-0002', clientName: 'St. Luke Medical Center',
      serialNumber: 'SN-PH-VM6-001', model: 'SureSigns VM6', manufacturer: 'Philips',
      status: 'Completed', subStatus: 'Invoiced', priority: 'normal',
      assignedTechId: carlosId, assignedTechName: 'Carlos Reyes',
      contact: 'Karen Mitchell', phone: '(555) 200-2000',
      site: 'Main Building', building: 'ER', location: 'Bay 1',
      customerIssue: 'NIBP reading high. Patient cuff shows 145/92 but manual check is 130/85.',
      woNotes: 'Cuff bladder had a slow leak. Replaced cuff and hose. Calibrated NIBP. Now within 2mmHg of reference.',
      skill: 'biomedical', createdBy, createdAt: daysAgo(7),
      invoiceNumber: 'INV-2026-0045',
      invoicedAt: daysAgo(5),
      billingRate: 85, invoiceTotal: 152.50,
      paymentStatus: 'invoiced',
      timeEntries: [{
        techId: carlosId, techName: 'Carlos Reyes', type: 'labor',
        clockIn: new Date(daysAgo(7).getTime() + 14*3600000),
        clockOut: new Date(daysAgo(7).getTime() + 15.5*3600000),
        duration: 1.5, billable: true,
      }],
      partsUsed: [{ name: 'NIBP Cuff + Hose (Adult)', sku: 'NIBP-PH-ADT', qty: 1, unitPrice: 25 }],
    },
    // Paid & Archived WO
    {
      woNumber: 'WO-2026-0225-001', type: 'PM', companyId: companyId1,
      clientId: 'TME-CL-0003', clientName: 'Peachtree Surgical Center',
      serialNumber: 'SN-SI-MRI-001', model: 'MAGNETOM Vida 3T', manufacturer: 'Siemens Healthineers',
      status: 'Completed', subStatus: 'Paid', priority: 'normal',
      assignedTechId: sarahId, assignedTechName: 'Sarah Chen',
      contact: 'Dr. Robert Chen', phone: '(555) 300-3000',
      site: 'Surgical Suite A', building: 'MRI Suite', location: 'Room MR-1',
      customerIssue: 'Annual PM on 3T MRI. Full system check including cryogen levels, gradient coils, RF calibration.',
      woNotes: 'All systems nominal. Cryogen at 78%. Gradient coils within spec. SNR test passed. Quench valve functional.',
      skill: 'specialty', createdBy, createdAt: daysAgo(11),
      invoiceNumber: 'INV-2026-0038',
      invoicedAt: daysAgo(9),
      paidAt: daysAgo(5),
      billingRate: 110, invoiceTotal: 880,
      paymentStatus: 'paid',
      sentToArchive: true,
      timeEntries: [{
        techId: sarahId, techName: 'Sarah Chen', type: 'labor',
        clockIn: new Date(daysAgo(11).getTime() + 7*3600000),
        clockOut: new Date(daysAgo(11).getTime() + 15*3600000),
        duration: 8, billable: true,
      }],
    },
    // MedServ WOs
    {
      woNumber: 'WO-2026-0308-005', type: 'WO', companyId: companyId2,
      clientId: 'TME-CL-0004', clientName: 'Valley Dialysis Network',
      serialNumber: 'SN-FMC-5008S-002', model: '5008S', manufacturer: 'Fresenius',
      status: 'Active', subStatus: 'Dispatched', priority: 'high',
      assignedTechId: jamesId, assignedTechName: 'James Foster',
      contact: 'Angela Foster', phone: '(555) 400-4000',
      site: 'Center 1 - Decatur', building: 'Main', location: 'Station 2',
      customerIssue: 'Dialysis machine throwing conductivity alarm during treatment. Had to move patient to different station. Conductivity reading fluctuating between 13.8-14.5 mS/cm.',
      skill: 'dialysis', createdBy: tomUser?._id?.toString() || 'system', createdAt: hoursAgo(3),
    },
    {
      woNumber: 'WO-2026-0307-001', type: 'PM', companyId: companyId2,
      clientId: 'TME-CL-0005', clientName: 'Northside Pediatric Hospital',
      serialNumber: 'SN-DR-BW-001', model: 'Babylog VN600', manufacturer: 'Drager',
      status: 'Completed', subStatus: 'Send Report', priority: 'high',
      assignedTechId: jamesId, assignedTechName: 'James Foster',
      contact: 'Dr. Maria Santos', phone: '(555) 500-5000',
      site: 'Pediatric ICU', building: 'NICU Wing', location: 'Bed 1',
      customerIssue: 'Semi-annual PM on neonatal ventilator. Critical — NICU life-support equipment.',
      woNotes: 'All tests passed. O2 sensor replaced. Tidal volume accuracy within 8%. All alarms verified. Battery holds 50 min. Exhalation valve replaced (preventive). Unit cleared for service.',
      skill: 'biomedical', createdBy: tomUser?._id?.toString() || 'system', createdAt: daysAgo(1),
      timeEntries: [{
        techId: jamesId, techName: 'James Foster', type: 'labor',
        clockIn: new Date(daysAgo(1).getTime() + 8*3600000),
        clockOut: new Date(daysAgo(1).getTime() + 11.5*3600000),
        duration: 3.5, billable: true,
      }],
      partsUsed: [
        { name: 'O2 Sensor Cell (Neonatal)', sku: 'O2S-DRG-NEO', qty: 1, unitPrice: 65 },
        { name: 'Exhalation Valve Assembly', sku: 'EXV-DRG-VN6', qty: 1, unitPrice: 150 },
      ],
      billingRate: 95, invoiceTotal: 547.50,
    },
  ];

  let wosCreated = 0;
  for (const wo of woData) {
    const exists = await WorkOrder.findOne({ woNumber: wo.woNumber });
    if (!exists) { await WorkOrder.create(wo); wosCreated++; }
  }
  console.log(`   ✅ ${wosCreated} work orders created\n`);

  // ── 5. INVENTORY ──
  console.log('📦 Seeding inventory...');
  const inventoryData = [
    // BiomediCorp inventory
    { companyId: companyId1, name: 'SpO2 Finger Probe (Universal)', sku: 'SPO2-FP-100', category: 'Accessories', quantity: 25, minQuantity: 10, cost: 18, sellPrice: 35, vendor: 'Medline', manufacturer: 'Nellcor' },
    { companyId: companyId1, name: 'NIBP Cuff Adult (27-35cm)', sku: 'NIBP-CUFF-ADT', category: 'Accessories', quantity: 15, minQuantity: 5, cost: 12, sellPrice: 25, vendor: 'Medline', manufacturer: 'Welch Allyn' },
    { companyId: companyId1, name: 'ECG Lead Set 5-Wire (Snap)', sku: 'ECG-5W-SNAP', category: 'Accessories', quantity: 20, minQuantity: 8, cost: 20, sellPrice: 40, vendor: 'Cardiomedics', manufacturer: 'Philips' },
    { companyId: companyId1, name: 'O2 Sensor Cell (Drager)', sku: 'O2S-DRG-V500', category: 'Sensors', quantity: 8, minQuantity: 4, cost: 30, sellPrice: 60, vendor: 'Drager Medical', manufacturer: 'Drager' },
    { companyId: companyId1, name: 'HEPA Filter (Ventilator)', sku: 'HEPA-DRG-001', category: 'Filters', quantity: 12, minQuantity: 6, cost: 12, sellPrice: 25, vendor: 'Drager Medical', manufacturer: 'Drager' },
    { companyId: companyId1, name: 'Infusion Pump Battery Pack', sku: 'BATT-BX-SS', category: 'Batteries', quantity: 6, minQuantity: 3, cost: 45, sellPrice: 85, vendor: 'Baxter Direct', manufacturer: 'Baxter' },
    { companyId: companyId1, name: 'Autoclave Door Gasket (V116)', sku: 'GSKT-ST-V116', category: 'Seals', quantity: 3, minQuantity: 2, cost: 80, sellPrice: 150, vendor: 'Steris Parts', manufacturer: 'Steris' },
    { companyId: companyId1, name: 'Biological Indicator (Spore)', sku: 'BI-SPORE-50PK', category: 'Testing', quantity: 4, minQuantity: 2, cost: 65, sellPrice: 120, vendor: '3M Healthcare', manufacturer: '3M', description: 'Pack of 50. Geobacillus stearothermophilus. 48hr readout.' },
    { companyId: companyId1, name: 'Temperature Probe (Skin)', sku: 'TEMP-SKIN-001', category: 'Accessories', quantity: 10, minQuantity: 5, cost: 15, sellPrice: 30, vendor: 'Medline', manufacturer: 'Philips' },
    { companyId: companyId1, name: 'Defibrillation Pads (Adult)', sku: 'DEFIB-PAD-ADT', category: 'Consumables', quantity: 20, minQuantity: 10, cost: 18, sellPrice: 40, vendor: 'Physio-Control', manufacturer: 'Stryker' },
    // MedServ inventory
    { companyId: companyId2, name: 'Dialysis Conductivity Probe', sku: 'COND-FMC-5008', category: 'Sensors', quantity: 5, minQuantity: 2, cost: 85, sellPrice: 165, vendor: 'Fresenius Parts', manufacturer: 'Fresenius' },
    { companyId: companyId2, name: 'O2 Sensor Cell (Neonatal)', sku: 'O2S-DRG-NEO', category: 'Sensors', quantity: 4, minQuantity: 2, cost: 35, sellPrice: 65, vendor: 'Drager Medical', manufacturer: 'Drager' },
    { companyId: companyId2, name: 'Exhalation Valve Assembly', sku: 'EXV-DRG-VN6', category: 'Components', quantity: 2, minQuantity: 1, cost: 80, sellPrice: 150, vendor: 'Drager Medical', manufacturer: 'Drager' },
    { companyId: companyId2, name: 'Water Treatment Filter Set', sku: 'WFLT-DLY-SET', category: 'Filters', quantity: 8, minQuantity: 4, cost: 120, sellPrice: 220, vendor: 'Mar Cor Purification', manufacturer: 'Mar Cor' },
    { companyId: companyId2, name: 'Patient Monitor Battery (Li-Ion)', sku: 'BATT-PH-LIION', category: 'Batteries', quantity: 6, minQuantity: 3, cost: 60, sellPrice: 120, vendor: 'Philips Parts', manufacturer: 'Philips' },
  ];

  let invCreated = 0;
  for (const inv of inventoryData) {
    const exists = await Inventory.findOne({ companyId: inv.companyId, sku: inv.sku });
    if (!exists) { await Inventory.create(inv); invCreated++; }
  }
  console.log(`   ✅ ${invCreated} inventory items created\n`);

  // ── Summary ──
  const counts = {
    users: await User.countDocuments(),
    clients: await Client.countDocuments(),
    workOrders: await WorkOrder.countDocuments(),
    assets: await Asset.countDocuments(),
    inventory: await Inventory.countDocuments(),
  };

  console.log('═══════════════════════════════════════════════════');
  console.log('  ✅ FULL SEED COMPLETE');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Users:       ${counts.users}`);
  console.log(`  Clients:     ${counts.clients}`);
  console.log(`  Work Orders: ${counts.workOrders}`);
  console.log(`  Assets:      ${counts.assets}`);
  console.log(`  Inventory:   ${counts.inventory}`);
  console.log('');
  console.log('  🔐 Login Credentials:');
  console.log('  ┌──────────────────┬──────────────────────────────┬──────────────────────┐');
  console.log('  │ Role             │ Email                        │ Password             │');
  console.log('  ├──────────────────┼──────────────────────────────┼──────────────────────┤');
  console.log('  │ Platform Owner   │ Tappout360                   │ Technical2026!Admin   │');
  console.log('  │ Company Admin    │ rachel@biomedicorp.com       │ BioMed#C1-2026!      │');
  console.log('  │ Admin            │ marcus@biomedicorp.com       │ Webb@Admin-4491      │');
  console.log('  │ Office Staff     │ lisa@biomedicorp.com         │ Park$Office2026      │');
  console.log('  │ Technician       │ carlos@biomedicorp.com       │ Reyes!Tech-7823      │');
  console.log('  │ Technician       │ sarah@biomedicorp.com        │ Chen$Tech-2145       │');
  console.log('  │ Client           │ admin@memorial.org           │ Memorial#Cl2026      │');
  console.log('  │ Company (c2)     │ tom@medserv.com              │ MedServ#C2-2026      │');
  console.log('  │ Tech (c2)        │ james@medserv.com            │ Foster!Tech9012      │');
  console.log('  │ Client (c2)      │ admin@stluke.org             │ StLuke#Client26      │');
  console.log('  └──────────────────┴──────────────────────────────┴──────────────────────┘');
  console.log('');
  console.log('  📋 Work Order Statuses for Testing:');
  console.log('     4 Active (2 Dispatched, 2 Unscheduled — dispatch board)');
  console.log('     3 Completed (Send Report — WO Control Board)');
  console.log('     1 Invoiced (awaiting payment)');
  console.log('     1 Paid & Archived');
  console.log('     1 Emergency (high priority)');
  console.log('');
  console.log('  🏥 Clients: 5 across 2 companies');
  console.log('  🔩 Assets:  14 across 5 sites');
  console.log('  📦 Inventory: 15 items with realistic pricing');
  console.log('═══════════════════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ SEED ERROR:', err.message);
  process.exit(1);
});
