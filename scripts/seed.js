// ═══════════════════════════════════════════════════════════════
//  SEED SCRIPT — Populates MongoDB with demo data matching
//  the frontend's mock data structure for dev/testing.
//
//  Usage: node scripts/seed.js
//  WARNING: This will DROP existing data and re-seed!
// ═══════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Company = require('../models/Company');
const Client = require('../models/Client');
const Asset = require('../models/Asset');
const WorkOrder = require('../models/WorkOrder');
const Inventory = require('../models/Inventory');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected for seeding');

    // ── Clear existing data ──
    await Promise.all([
      User.deleteMany({}),
      Company.deleteMany({}),
      Client.deleteMany({}),
      Asset.deleteMany({}),
      WorkOrder.deleteMany({}),
      Inventory.deleteMany({})
    ]);
    console.log('🗑️  Cleared existing data');

    // ── 1. Create Company ──
    const company = await Company.create({
      name: 'BiomediCorp Services',
      status: 'active',
      ownerId: 'owner-1',
      companySettings: {
        displayName: 'BiomediCorp Services',
        tagline: 'Precision Medical Equipment Management',
        logo: '🏥',
        accentColor: '#00e5ff',
        subscription: 'enterprise',
        features: {
          createWO: true, viewWOs: true, messages: true,
          calendar: true, archive: true, billing: true,
          assets: true, inventory: true, integrations: true
        }
      }
    });
    const companyId = company._id.toString();
    console.log(`🏢 Company: ${company.name} (${companyId})`);

    // ── 2. Create Users ──
    const hashedPw = await bcrypt.hash('Admin123!', 10);

    const users = await User.insertMany([
      {
        role: 'OWNER', name: 'Jason Mounts', email: 'jason@technical-made-easy.com',
        password: hashedPw, companyId: null, active: true
      },
      {
        role: 'COMPANY', name: 'Rachel Kim', email: 'rachel@biomedicorp.com',
        password: hashedPw, companyId, active: true
      },
      {
        role: 'ADMIN', name: 'David Chen', email: 'david@biomedicorp.com',
        password: hashedPw, companyId, active: true
      },
      {
        role: 'OFFICE', name: 'Sarah Kim', email: 'sarah@biomedicorp.com',
        password: hashedPw, companyId, active: true
      },
      {
        role: 'TECH', name: 'Carlos Rivera', email: 'carlos@biomedicorp.com',
        password: hashedPw, companyId, active: true, techSkill: 'Specialty', rating: 4.8
      },
      {
        role: 'TECH', name: 'Mike Thompson', email: 'mike@biomedicorp.com',
        password: hashedPw, companyId, active: true, techSkill: 'Basic/General', rating: 4.5
      },
      {
        role: 'TECH', name: 'Lisa Patel', email: 'lisa@biomedicorp.com',
        password: hashedPw, companyId, active: true, techSkill: 'Specialty', rating: 4.9
      },
      {
        role: 'CLIENT', name: 'Mercy General - Bio',
        email: 'biomed@mercygeneral.com', password: hashedPw,
        companyId, accountNumber: 'MG-1001',
        clientCompany: 'Mercy General Hospital', active: true
      },
      {
        role: 'CLIENT', name: 'St. Luke\'s Medical',
        email: 'biomed@stlukes.com', password: hashedPw,
        companyId, accountNumber: 'SL-2002',
        clientCompany: 'St. Luke\'s Medical Center', active: true
      },
      {
        role: 'CLIENT', name: 'Valley Children\'s',
        email: 'biomed@valleychildrens.com', password: hashedPw,
        companyId, accountNumber: 'VC-3003',
        clientCompany: 'Valley Children\'s Hospital', active: true
      }
    ]);
    console.log(`👥 Created ${users.length} users`);

    // ── 3. Create Clients ──
    const clients = await Client.insertMany([
      {
        accountNumber: 'MG-1001', name: 'Mercy General Hospital',
        contactName: 'Dr. Amanda Foster', phone: '(555) 100-1001',
        email: 'biomed@mercygeneral.com', address: '2175 Rosedale Hwy, Bakersfield, CA 93305',
        sites: ['Main Campus', 'East Wing'], companyId,
        userId: users.find(u => u.accountNumber === 'MG-1001')?._id?.toString() || '',
        status: 'active', rating: 5
      },
      {
        accountNumber: 'SL-2002', name: 'St. Luke\'s Medical Center',
        contactName: 'James Wheeler', phone: '(555) 200-2002',
        email: 'biomed@stlukes.com', address: '915 Chester Ave, Bakersfield, CA 93301',
        sites: ['Main Building', 'Surgery Center'], companyId,
        userId: users.find(u => u.accountNumber === 'SL-2002')?._id?.toString() || '',
        status: 'active', rating: 4
      },
      {
        accountNumber: 'VC-3003', name: 'Valley Children\'s Hospital',
        contactName: 'Rosa Martinez', phone: '(555) 300-3003',
        email: 'biomed@valleychildrens.com', address: '9300 Valley Children Pl, Madera, CA 93636',
        sites: ['NICU', 'Pediatric Wing', 'Outpatient'], companyId,
        userId: users.find(u => u.accountNumber === 'VC-3003')?._id?.toString() || '',
        status: 'active', rating: 5
      }
    ]);
    console.log(`🏥 Created ${clients.length} clients`);

    // ── 4. Create Assets ──
    const assets = await Asset.insertMany([
      {
        qrTag: 'BIO0001', serialNumber: 'SN-GE-001', cmNumber: 'CM-001',
        model: 'Carescape B650', manufacturer: 'GE Healthcare',
        department: 'ICU', site: 'Main Campus', building: 'A', location: 'Room 401',
        clientId: clients[0]._id.toString(), companyId, status: 'operational',
        warrantyEnd: '2027-06-15', lastPM: '2026-01-15', pmCycle: 'semi-annual'
      },
      {
        qrTag: 'BIO0002', serialNumber: 'SN-PHI-002', cmNumber: 'CM-002',
        model: 'IntelliVue MX800', manufacturer: 'Philips',
        department: 'OR', site: 'Surgery Center', building: 'B', location: 'OR-3',
        clientId: clients[1]._id.toString(), companyId, status: 'operational',
        warrantyEnd: '2026-12-01', lastPM: '2026-02-01', pmCycle: 'quarterly'
      },
      {
        qrTag: 'BIO0003', serialNumber: 'SN-MED-003', cmNumber: 'CM-003',
        model: 'Sigma Spectrum', manufacturer: 'Baxter',
        department: 'NICU', site: 'NICU', building: 'C', location: 'Bay 12',
        clientId: clients[2]._id.toString(), companyId, status: 'needs-repair',
        warrantyEnd: '2025-09-01', lastPM: '2025-12-01', pmCycle: 'annual'
      },
      {
        qrTag: 'BIO0004', serialNumber: 'SN-ZOL-004', cmNumber: 'CM-004',
        model: 'R Series', manufacturer: 'ZOLL',
        department: 'ER', site: 'Main Campus', building: 'A', location: 'ER Bay 1',
        clientId: clients[0]._id.toString(), companyId, status: 'operational',
        warrantyEnd: '2027-03-01', lastPM: '2026-02-10', pmCycle: 'semi-annual'
      },
      {
        qrTag: 'BIO0005', serialNumber: 'SN-DRA-005', cmNumber: 'CM-005',
        model: 'Fabius GS Premium', manufacturer: 'Dräger',
        department: 'OR', site: 'Surgery Center', building: 'B', location: 'OR-1',
        clientId: clients[1]._id.toString(), companyId, status: 'operational',
        warrantyEnd: '2028-01-01', lastPM: '2026-01-20', pmCycle: 'semi-annual'
      }
    ]);
    console.log(`🔧 Created ${assets.length} assets`);

    // ── 5. Create Work Orders ──
    const techCarlos = users.find(u => u.name === 'Carlos Rivera');
    const techMike = users.find(u => u.name === 'Mike Thompson');

    const workOrders = await WorkOrder.insertMany([
      {
        woNumber: 'WO-2026-001', type: 'WO', formType: 'WO',
        companyId, clientId: clients[0]._id.toString(),
        accountNumber: 'MG-1001', clientName: 'Mercy General Hospital',
        assetId: assets[0]._id.toString(), serialNumber: 'SN-GE-001',
        model: 'Carescape B650', skill: 'Specialty', woType: 'Repair',
        status: 'Active', subStatus: 'In Progress', emergency: false,
        contact: 'Dr. Amanda Foster', phone: '(555) 100-1001',
        email: 'biomed@mercygeneral.com', site: 'Main Campus',
        building: 'A', location: 'Room 401',
        customerIssue: 'SpO2 module intermittent reading. Alarm fatigue reported by nursing.',
        assignedTechId: techCarlos._id.toString(),
        assignedTechName: 'Carlos Rivera',
        createdBy: users[3]._id.toString(),
        timeEntries: [{
          techId: techCarlos._id.toString(), techName: 'Carlos Rivera',
          type: 'labor', clockIn: new Date('2026-02-26T08:00:00'),
          clockOut: new Date('2026-02-26T10:30:00'), duration: 2.5, billable: true
        }]
      },
      {
        woNumber: 'WO-2026-002', type: 'PM', formType: 'PM',
        companyId, clientId: clients[1]._id.toString(),
        accountNumber: 'SL-2002', clientName: 'St. Luke\'s Medical Center',
        assetId: assets[1]._id.toString(), serialNumber: 'SN-PHI-002',
        model: 'IntelliVue MX800', skill: 'Specialty', woType: 'PM Inspection',
        status: 'Completed', subStatus: 'Send Report', emergency: false,
        contact: 'James Wheeler', phone: '(555) 200-2002',
        email: 'biomed@stlukes.com', site: 'Surgery Center',
        building: 'B', location: 'OR-3',
        customerIssue: 'Quarterly PM inspection due.',
        woNotes: 'All parameters within spec. Replaced NIBP hose. Cleaned display.',
        assignedTechId: techMike._id.toString(),
        assignedTechName: 'Mike Thompson',
        createdBy: users[3]._id.toString(),
        procedures: [
          { step: 'Visual inspection', result: 'PASS', critical: false },
          { step: 'Alarm test — all channels', result: 'PASS', critical: true },
          { step: 'SpO2 accuracy (±2%)', result: 'PASS', critical: true },
          { step: 'NIBP accuracy (±3mmHg)', result: 'PASS', critical: true },
          { step: 'ECG waveform quality', result: 'PASS', critical: false }
        ],
        timeEntries: [{
          techId: techMike._id.toString(), techName: 'Mike Thompson',
          type: 'labor', clockIn: new Date('2026-02-25T09:00:00'),
          clockOut: new Date('2026-02-25T10:15:00'), duration: 1.25, billable: true
        }]
      },
      {
        woNumber: 'WO-2026-003', type: 'WO', formType: 'WO',
        companyId, clientId: clients[2]._id.toString(),
        accountNumber: 'VC-3003', clientName: 'Valley Children\'s Hospital',
        assetId: assets[2]._id.toString(), serialNumber: 'SN-MED-003',
        model: 'Sigma Spectrum', skill: 'Basic/General', woType: 'Repair',
        status: 'Active', subStatus: 'Unscheduled', emergency: true,
        priority: 'high',
        contact: 'Rosa Martinez', phone: '(555) 300-3003',
        email: 'biomed@valleychildrens.com', site: 'NICU',
        building: 'C', location: 'Bay 12',
        customerIssue: 'EMERGENCY: Infusion pump showing "Downstream Occlusion" repeatedly. Patient on TPN.',
        createdBy: users[3]._id.toString()
      }
    ]);
    console.log(`📋 Created ${workOrders.length} work orders`);

    // ── 6. Create Inventory ──
    const inventoryItems = await Inventory.insertMany([
      { companyId, name: 'SpO2 Sensor (Adult Reusable)', sku: 'SPO2-AR-100', category: 'Patient Monitoring', quantity: 12, minQuantity: 5, cost: 45.00, sellPrice: 89.00, vendor: 'Nellcor', manufacturer: 'Medtronic' },
      { companyId, name: 'ECG Lead Wire Set', sku: 'ECG-LW-200', category: 'Patient Monitoring', quantity: 8, minQuantity: 3, cost: 32.00, sellPrice: 65.00, vendor: 'Philips Medical', manufacturer: 'Philips' },
      { companyId, name: 'NIBP Hose (Adult)', sku: 'NIBP-H-300', category: 'Patient Monitoring', quantity: 15, minQuantity: 5, cost: 18.00, sellPrice: 35.00, vendor: 'SunTech Medical', manufacturer: 'SunTech' },
      { companyId, name: 'Defibrillator Pads (Adult)', sku: 'DEF-PAD-400', category: 'Diagnostic', quantity: 20, minQuantity: 10, cost: 25.00, sellPrice: 55.00, vendor: 'ZOLL Medical', manufacturer: 'ZOLL' },
      { companyId, name: 'IV Pump Tubing Set', sku: 'IV-TS-500', category: 'General', quantity: 30, minQuantity: 10, cost: 8.50, sellPrice: 18.00, vendor: 'Baxter International', manufacturer: 'Baxter' },
      { companyId, name: 'Anesthesia Vaporizer O-Ring Kit', sku: 'ANES-OR-600', category: 'Surgical', quantity: 6, minQuantity: 3, cost: 12.00, sellPrice: 28.00, vendor: 'Dräger Medical', manufacturer: 'Dräger' },
      { companyId, name: 'Autoclave Gasket (Large Door)', sku: 'AUTO-G-700', category: 'Sterilization', quantity: 4, minQuantity: 2, cost: 85.00, sellPrice: 165.00, vendor: 'Getinge', manufacturer: 'Getinge' },
      { companyId, name: 'Fiber Optic Cable (Endoscopy)', sku: 'FOC-12', category: 'Imaging', quantity: 3, minQuantity: 2, cost: 120.00, sellPrice: 245.00, vendor: 'Olympus', manufacturer: 'Olympus' },
      { companyId, name: 'Ventilator Flow Sensor', sku: 'VENT-FS-900', category: 'Respiratory', quantity: 7, minQuantity: 3, cost: 55.00, sellPrice: 110.00, vendor: 'Hamilton Medical', manufacturer: 'Hamilton' },
      { companyId, name: 'Battery Pack (Defibrillator)', sku: 'BAT-DEF-1000', category: 'Diagnostic', quantity: 5, minQuantity: 3, cost: 180.00, sellPrice: 350.00, vendor: 'Physio-Control', manufacturer: 'Stryker' },
      // Van stock items for Carlos
      { companyId, name: 'Fuse Kit (Assorted)', sku: 'FK-AST', category: 'Electrical', quantity: 20, minQuantity: 5, cost: 3.50, sellPrice: 8.00, vendor: 'Eaton', manufacturer: 'Eaton', vanTechId: techCarlos._id.toString() },
      { companyId, name: '2.5mm Catheter Lead', sku: 'CL-250', category: 'Patient Monitoring', quantity: 4, minQuantity: 2, cost: 15.00, sellPrice: 32.00, vendor: 'Philips', manufacturer: 'Philips', vanTechId: techCarlos._id.toString() },
    ]);
    console.log(`📦 Created ${inventoryItems.length} inventory items`);

    // ── Summary ──
    console.log('\n═══════════════════════════════════════');
    console.log('  ✅ SEED COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`  🏢 1 Company`);
    console.log(`  👥 ${users.length} Users (pw: Admin123!)`);
    console.log(`  🏥 ${clients.length} Clients`);
    console.log(`  🔧 ${assets.length} Assets`);
    console.log(`  📋 ${workOrders.length} Work Orders`);
    console.log(`  📦 ${inventoryItems.length} Inventory Items`);
    console.log('═══════════════════════════════════════');
    console.log('\nLogin accounts (all use password: Admin123!):');
    users.forEach(u => console.log(`  ${u.role.padEnd(8)} → ${u.email}`));
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed Error:', err);
    process.exit(1);
  }
}

seed();
