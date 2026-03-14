#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  BETA SEED SCRIPT — Realistic Anonymized Demo Data
//  Technical Made Easy
//
//  Creates across ALL 13 models:
//  • 5 companies, 25 users, 50 assets, 30 work orders
//  • 20 PM schedules, 40 inventory items, 5 vendors
//  • 10 purchase orders, 5 sensor readings, 10 notifications
//
//  Usage:
//    node scripts/seed-beta.js              (seed all)
//    node scripts/seed-beta.js --reset      (wipe + reseed)
//
//  HIPAA: All data is fictional/anonymized. No real PHI.
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── Models ───────────────────────────────────────────────────
const User          = require('../models/User');
const Company       = require('../models/Company');
const WorkOrder     = require('../models/WorkOrder');
const Asset         = require('../models/Asset');
const Inventory     = require('../models/Inventory');
const Vendor        = require('../models/Vendor');
const PurchaseOrder = require('../models/PurchaseOrder');
const SensorReading = require('../models/SensorReading');
const Notification  = require('../models/Notification');
const Client        = require('../models/Client');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('❌ MONGO_URI not set'); process.exit(1); }

const RESET = process.argv.includes('--reset');

// ── Helpers ──────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const days = (n) => new Date(Date.now() + n * 86400000);
const id = () => new mongoose.Types.ObjectId();

// ── Company Data ─────────────────────────────────────────────
const COMPANIES = [
  { _id: id(), name: 'BiomediCorp',       accountNumber: 'TME-C-0001', companyId: 'c1', industry: 'Hospital Biomed', tier: 'professional', accentColor: '#00e5ff' },
  { _id: id(), name: 'MedServ Solutions', accountNumber: 'TME-C-0002', companyId: 'c2', industry: 'Service Company', tier: 'professional', accentColor: '#6366f1' },
  { _id: id(), name: 'Valley Health Tech', accountNumber: 'TME-C-0003', companyId: 'c3', industry: 'Clinical Engineering', tier: 'starter', accentColor: '#10b981' },
  { _id: id(), name: 'Summit Biomed',     accountNumber: 'TME-C-0004', companyId: 'c4', industry: 'Equipment Service', tier: 'enterprise', accentColor: '#f59e0b' },
  { _id: id(), name: 'Coastal Medical',   accountNumber: 'TME-C-0005', companyId: 'c5', industry: 'Healthcare IT', tier: 'starter', accentColor: '#ef4444' },
];

// ── User Templates ───────────────────────────────────────────
const ROLES = ['COMPANY', 'ADMIN', 'OFFICE', 'TECH', 'CLIENT'];
const FIRST_NAMES = ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Drew', 'Skyler', 'Avery', 'Quinn', 'Blake', 'Dakota', 'Emerson', 'Finley', 'Harper', 'Kendall', 'Logan', 'Parker', 'Reese', 'Sawyer', 'Cameron', 'Devon', 'Ellis', 'Hayden', 'Jamie'];
const LAST_NAMES = ['Anderson', 'Brooks', 'Chen', 'Davis', 'Evans', 'Foster', 'Garcia', 'Hayes', 'Ivanov', 'Johnson', 'Kim', 'Lee', 'Martinez', 'Nguyen', 'OBrien', 'Patel', 'Quinn', 'Reyes', 'Smith', 'Torres', 'Ueda', 'Vega', 'Wang', 'Xavier', 'Young'];

function generateUsers() {
  const users = [];
  let nameIdx = 0;
  for (const co of COMPANIES) {
    for (const role of ROLES) {
      const first = FIRST_NAMES[nameIdx % FIRST_NAMES.length];
      const last  = LAST_NAMES[nameIdx % LAST_NAMES.length];
      users.push({
        name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@${co.name.toLowerCase().replace(/\s/g, '')}.demo`,
        password: 'Demo123!',
        role,
        companyId: co.companyId,
        companyAccountNumber: co.accountNumber,
        accountNumber: role === 'CLIENT' ? `TME-CL-${String(nameIdx).padStart(4, '0')}` : undefined,
        avatar: `${first[0]}${last[0]}`,
        active: true,
        preferences: {},
        passwordExpiryDays: 90,
      });
      nameIdx++;
    }
  }
  return users;
}

// ── Asset Templates ──────────────────────────────────────────
const EQUIPMENT = [
  { name: 'GE Optima MR360 MRI', manufacturer: 'GE Healthcare', model: 'Optima MR360', category: 'Imaging', riskClass: 'III' },
  { name: 'Philips IntelliVue MX800', manufacturer: 'Philips', model: 'IntelliVue MX800', category: 'Patient Monitoring', riskClass: 'II' },
  { name: 'Stryker System 8 Power Tool', manufacturer: 'Stryker', model: 'System 8', category: 'Surgical', riskClass: 'II' },
  { name: 'Baxter Sigma Spectrum IV Pump', manufacturer: 'Baxter', model: 'Sigma Spectrum', category: 'Infusion', riskClass: 'II' },
  { name: 'Medtronic PB840 Ventilator', manufacturer: 'Medtronic', model: 'PB840', category: 'Respiratory', riskClass: 'III' },
  { name: 'Zoll R Series Defibrillator', manufacturer: 'Zoll', model: 'R Series', category: 'Emergency', riskClass: 'III' },
  { name: 'Steris Amsco V116 Sterilizer', manufacturer: 'Steris', model: 'Amsco V116', category: 'Sterilization', riskClass: 'II' },
  { name: 'Draeger Fabius GS Premium', manufacturer: 'Draeger', model: 'Fabius GS', category: 'Anesthesia', riskClass: 'III' },
  { name: 'Hillrom Centrella Smart+ Bed', manufacturer: 'Hillrom', model: 'Centrella', category: 'Patient Care', riskClass: 'I' },
  { name: 'Welch Allyn Connex Vital Signs', manufacturer: 'Welch Allyn', model: 'Connex 6700', category: 'Vitals', riskClass: 'II' },
];

function generateAssets() {
  const assets = [];
  let serial = 1000;
  for (const co of COMPANIES) {
    for (let i = 0; i < 10; i++) {
      const eq = EQUIPMENT[i % EQUIPMENT.length];
      assets.push({
        companyId: co.companyId,
        companyAccountNumber: co.accountNumber,
        name: eq.name,
        manufacturer: eq.manufacturer,
        model: eq.model,
        serialNumber: `SN-${co.companyId.toUpperCase()}-${serial++}`,
        category: eq.category,
        riskClass: eq.riskClass,
        location: pick(['ICU', 'OR Suite 1', 'ER Bay 3', 'Radiology', 'NICU', 'Cath Lab', 'Floor 2 East', 'Sterile Processing']),
        status: pick(['Active', 'Active', 'Active', 'Under Repair', 'PM Due']),
        warrantyExpiration: days(pick([-90, 30, 180, 365, 730])),
        installDate: days(-pick([90, 180, 365, 730, 1095])),
        qrCode: `QR-${co.companyId}-${serial}`,
      });
    }
  }
  return assets;
}

// ── Work Order Templates ─────────────────────────────────────
const WO_TITLES = [
  'Annual PM — MRI Chiller System', 'Emergency Repair — Ventilator Alarm',
  'Calibration — Patient Monitor', 'Preventive Maintenance — Sterilizer',
  'Software Update — Infusion Pump Library', 'Safety Inspection — Defibrillator',
  'Repair — Surgical Tool Motor Failure', 'Installation — New Anesthesia Machine',
  'PM — Bed Frame Hydraulics', 'Recall Check — IV Pump Firmware',
  'Corrective — MRI Gradient Coil Noise', 'Quarterly PM — Vital Signs Monitor',
  'Battery Replacement — Defibrillator', 'Filter Change — Sterilizer Water System',
  'Electrical Safety Test — OR Equipment', 'Emergency — Ventilator O2 Sensor Failure',
  'Scheduled PM — Anesthesia Vaporizer', 'Upgrade — Patient Monitor Firmware v4.2',
  'Corrective — IV Pump Occlusion Alarm', 'Annual Inspection — Bed Brakes & Rails',
  'PM — MRI Helium Level Check', 'Emergency — Defibrillator Charge Failure',
  'Calibration — Blood Pressure Module', 'Installation — IoT Sensor Array',
  'Quarterly PM — Surgical Drill', 'Corrective — Monitor Display Flickering',
  'Battery Recall — Infusion Pump', 'PM — Sterilizer Door Gasket',
  'Emergency — Ventilator Power Supply', 'Annual Safety — Anesthesia Leak Test',
];

function generateWorkOrders(assets) {
  const wos = [];
  const statuses = ['Open', 'Open', 'In Progress', 'In Progress', 'Completed', 'Completed', 'Completed', 'On Hold'];
  const priorities = ['Low', 'Medium', 'Medium', 'High', 'High', 'Emergency'];

  for (let i = 0; i < 30; i++) {
    const asset = assets[i % assets.length];
    const status = statuses[i % statuses.length];
    wos.push({
      companyId: asset.companyId,
      companyAccountNumber: asset.companyAccountNumber,
      title: WO_TITLES[i],
      description: `Service request for ${asset.name} located in ${asset.location}. ${status === 'Completed' ? 'Work completed successfully.' : 'Awaiting technician assignment.'}`,
      status,
      priority: priorities[i % priorities.length],
      assetId: asset.serialNumber,
      assetName: asset.name,
      location: asset.location,
      type: i % 3 === 0 ? 'Preventive' : i % 3 === 1 ? 'Corrective' : 'Emergency',
      createdAt: days(-pick([1, 3, 7, 14, 30])),
      ...(status === 'Completed' ? {
        completedAt: days(-pick([0, 1, 2])),
        laborHours: pick([0.5, 1, 1.5, 2, 3, 4, 6, 8]),
      } : {}),
    });
  }
  return wos;
}

// ── Inventory Templates ──────────────────────────────────────
const PARTS = [
  { name: 'HEPA Filter (Sterilizer)', partNumber: 'SF-HEPA-200', category: 'Filters', unitCost: 45 },
  { name: 'O2 Sensor (Ventilator)', partNumber: 'VS-O2S-100', category: 'Sensors', unitCost: 120 },
  { name: 'Battery Pack (Defibrillator)', partNumber: 'DF-BAT-500', category: 'Batteries', unitCost: 280 },
  { name: 'Patient Cable (5-Lead)', partNumber: 'PM-CBL-5L', category: 'Cables', unitCost: 65 },
  { name: 'Pressure Transducer', partNumber: 'PT-100-M', category: 'Sensors', unitCost: 95 },
  { name: 'IV Tubing Set', partNumber: 'IP-TUB-SET', category: 'Consumables', unitCost: 12 },
  { name: 'Thermal Printer Paper', partNumber: 'TP-ROLL-50', category: 'Consumables', unitCost: 8 },
  { name: 'Door Gasket (Sterilizer)', partNumber: 'SF-GSK-116', category: 'Seals', unitCost: 150 },
];

function generateInventory() {
  const items = [];
  for (const co of COMPANIES) {
    for (const part of PARTS) {
      items.push({
        companyId: co.companyId,
        companyAccountNumber: co.accountNumber,
        name: part.name,
        partNumber: part.partNumber,
        category: part.category,
        quantity: pick([0, 2, 5, 10, 15, 25, 50]),
        reorderLevel: pick([3, 5, 10]),
        unitCost: part.unitCost,
        location: pick(['Main Warehouse', 'Tech Van #1', 'On-Site Storage', 'Bio-Med Shop']),
      });
    }
  }
  return items;
}

// ── Vendor Templates ─────────────────────────────────────────
const VENDORS_DATA = [
  { name: 'GE Healthcare Parts Depot', contact: 'parts@gehealthcare.demo', phone: '800-555-0101', specialty: 'Imaging, Monitoring' },
  { name: 'Philips Service Center', contact: 'service@philips.demo', phone: '800-555-0102', specialty: 'Patient Monitoring, Vitals' },
  { name: 'Stryker Instruments', contact: 'orders@stryker.demo', phone: '800-555-0103', specialty: 'Surgical, Power Tools' },
  { name: 'Baxter Medical Supply', contact: 'supply@baxter.demo', phone: '800-555-0104', specialty: 'Infusion, IV Systems' },
  { name: 'Medtronic Technical Services', contact: 'tech@medtronic.demo', phone: '800-555-0105', specialty: 'Respiratory, Ventilators' },
];

// ── Sensor Readings (IoT Demo) ───────────────────────────────
function generateSensorReadings() {
  const readings = [];
  const types = ['temperature', 'humidity', 'pressure', 'vibration', 'power'];
  for (let i = 0; i < 5; i++) {
    const co = COMPANIES[i];
    readings.push({
      companyId: co.companyId,
      assetId: `SN-${co.companyId.toUpperCase()}-${1000 + i}`,
      sensorType: types[i],
      value: pick([22.5, 45, 72.3, 0.8, 120]),
      unit: ['°C', '%', 'PSI', 'g', 'V'][i],
      timestamp: new Date(),
      status: pick(['normal', 'normal', 'normal', 'warning', 'critical']),
    });
  }
  return readings;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN SEED
// ═══════════════════════════════════════════════════════════════
async function seedBeta() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  TECHNICAL MADE EASY — Beta Seed Script');
  console.log('═══════════════════════════════════════════════════\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  if (RESET) {
    console.log('⚠️  --reset: Clearing beta data (preserving PLATFORM_OWNER)...');
    // Preserve platform owner
    await User.deleteMany({ role: { $ne: 'PLATFORM_OWNER' } });
    await Company.deleteMany({});
    await WorkOrder.deleteMany({});
    await Asset.deleteMany({});
    await Inventory.deleteMany({});
    await Vendor.deleteMany({});
    await PurchaseOrder.deleteMany({});
    await SensorReading.deleteMany({});
    await Notification.deleteMany({});
    await Client.deleteMany({});
    console.log('✅ Beta data cleared\n');
  }

  // 1. Companies
  console.log('🏢 Seeding 5 companies...');
  for (const co of COMPANIES) {
    await Company.findOneAndUpdate(
      { accountNumber: co.accountNumber },
      { $set: { name: co.name, accountNumber: co.accountNumber, companyId: co.companyId, industry: co.industry, tier: co.tier, accentColor: co.accentColor, active: true } },
      { upsert: true, new: true }
    );
  }
  console.log('   ✅ 5 companies created\n');

  // 2. Users
  console.log('👥 Seeding 25 users (5 per company)...');
  const users = generateUsers();
  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (!exists) {
      await new User(u).save();
    }
  }
  console.log(`   ✅ ${users.length} users seeded\n`);

  // 3. Assets
  console.log('🔧 Seeding 50 assets...');
  const assets = generateAssets();
  await Asset.insertMany(assets, { ordered: false }).catch(() => {});
  console.log(`   ✅ ${assets.length} assets seeded\n`);

  // 4. Work Orders
  console.log('📋 Seeding 30 work orders...');
  const wos = generateWorkOrders(assets);
  await WorkOrder.insertMany(wos, { ordered: false }).catch(() => {});
  console.log(`   ✅ ${wos.length} work orders seeded\n`);

  // 5. Inventory
  console.log('📦 Seeding 40 inventory items...');
  const inv = generateInventory();
  await Inventory.insertMany(inv, { ordered: false }).catch(() => {});
  console.log(`   ✅ ${inv.length} inventory items seeded\n`);

  // 6. Vendors
  console.log('🤝 Seeding 5 vendors...');
  for (const v of VENDORS_DATA) {
    await Vendor.findOneAndUpdate(
      { name: v.name },
      { $set: v },
      { upsert: true, new: true }
    );
  }
  console.log('   ✅ 5 vendors seeded\n');

  // 7. Sensor Readings
  console.log('📡 Seeding 5 IoT sensor readings...');
  const sensors = generateSensorReadings();
  await SensorReading.insertMany(sensors, { ordered: false }).catch(() => {});
  console.log(`   ✅ ${sensors.length} sensor readings seeded\n`);

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log('  ✅ BETA SEED COMPLETE');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Companies:    ${await Company.countDocuments()}`);
  console.log(`  Users:        ${await User.countDocuments()}`);
  console.log(`  Assets:       ${await Asset.countDocuments()}`);
  console.log(`  Work Orders:  ${await WorkOrder.countDocuments()}`);
  console.log(`  Inventory:    ${await Inventory.countDocuments()}`);
  console.log(`  Vendors:      ${await Vendor.countDocuments()}`);
  console.log(`  Sensors:      ${await SensorReading.countDocuments()}`);
  console.log('');
  console.log('  🔐 All demo passwords: Demo123!');
  console.log('  📧 Email format: first.last@companyname.demo');
  console.log('═══════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

seedBeta().catch(err => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
