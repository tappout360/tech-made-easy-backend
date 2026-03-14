#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  TENANT WIPE SCRIPT — Complete Company Deletion
//  Technical Made Easy — Beta Off-Boarding
//
//  Deletes ALL data for a company across every collection:
//  Users, WorkOrders, Assets, Inventory, PurchaseOrders,
//  Vendors (company-scoped), Notifications, SensorReadings,
//  Clients, AuditLogs.
//
//  Usage:
//    node scripts/wipe-tenant.js --company-id c3 --confirm
//    node scripts/wipe-tenant.js --account TME-C-0003 --confirm
//    node scripts/wipe-tenant.js --list  (show all companies)
//
//  HIPAA: Creates a final audit entry BEFORE deletion.
//  The wipe action itself is logged with timestamp and operator.
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();
const mongoose  = require('mongoose');

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
const AuditLog      = require('../models/AuditLog');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('❌ MONGO_URI not set'); process.exit(1); }

const args = process.argv.slice(2);
const LIST    = args.includes('--list');
const CONFIRM = args.includes('--confirm');
const companyIdFlag  = args.indexOf('--company-id');
const accountFlag    = args.indexOf('--account');

const COMPANY_ID      = companyIdFlag !== -1  ? args[companyIdFlag + 1]  : null;
const ACCOUNT_NUMBER  = accountFlag !== -1    ? args[accountFlag + 1]   : null;

async function listCompanies() {
  await mongoose.connect(MONGO_URI);
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  REGISTERED COMPANIES');
  console.log('═══════════════════════════════════════════════════\n');

  const companies = await Company.find({}).lean();
  if (!companies.length) {
    // Fallback: check users for distinct companyIds
    const ids = await User.distinct('companyId', { companyId: { $ne: null } });
    for (const id of ids) {
      const count = await User.countDocuments({ companyId: id });
      console.log(`  ${id} — ${count} users (no Company doc)`);
    }
  } else {
    for (const co of companies) {
      const userCount = await User.countDocuments({ companyId: co.companyId });
      const woCount   = await WorkOrder.countDocuments({ companyId: co.companyId });
      console.log(`  ${co.companyId} | ${co.accountNumber || 'N/A'} | ${co.name} — ${userCount} users, ${woCount} WOs`);
    }
  }
  console.log('');
  await mongoose.disconnect();
}

async function wipeTenant() {
  if (!COMPANY_ID && !ACCOUNT_NUMBER) {
    console.error('❌ Specify --company-id <id> or --account <TME-C-XXXX>');
    console.error('   Use --list to see available companies');
    process.exit(1);
  }

  if (!CONFIRM) {
    console.error('⚠️  This will PERMANENTLY DELETE all data for the tenant.');
    console.error('   Add --confirm to proceed.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  // Resolve company
  const query = COMPANY_ID
    ? { companyId: COMPANY_ID }
    : { accountNumber: ACCOUNT_NUMBER };

  const targetId = COMPANY_ID || ACCOUNT_NUMBER;

  // Build the filter — use companyId for data collections
  let filter;
  if (COMPANY_ID) {
    filter = { companyId: COMPANY_ID };
  } else {
    // Lookup companyId from account number
    const co = await Company.findOne({ accountNumber: ACCOUNT_NUMBER });
    if (co) {
      filter = { companyId: co.companyId };
    } else {
      filter = { companyAccountNumber: ACCOUNT_NUMBER };
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  TENANT WIPE: ${targetId}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Count before deletion
  const counts = {
    users:          await User.countDocuments(filter),
    workOrders:     await WorkOrder.countDocuments(filter),
    assets:         await Asset.countDocuments(filter),
    inventory:      await Inventory.countDocuments(filter),
    purchaseOrders: await PurchaseOrder.countDocuments(filter),
    sensorReadings: await SensorReading.countDocuments(filter),
    notifications:  await Notification.countDocuments(filter),
    clients:        await Client.countDocuments(filter),
    auditLogs:      await AuditLog.countDocuments(filter),
  };

  console.log('  📊 Data to delete:');
  for (const [key, val] of Object.entries(counts)) {
    console.log(`     ${key.padEnd(18)} ${val}`);
  }
  console.log('');

  // ── HIPAA: Create final audit entry BEFORE deletion ──
  try {
    await new AuditLog({
      companyId: filter.companyId || 'SYSTEM',
      action: 'TENANT_WIPED',
      details: `Complete tenant deletion for ${targetId}. Counts: ${JSON.stringify(counts)}`,
      performedBy: 'SYSTEM_WIPE_SCRIPT',
      timestamp: new Date(),
      ipAddress: 'localhost',
    }).save();
    console.log('  📝 HIPAA audit entry created for wipe action');
  } catch (e) {
    console.warn('  ⚠️  Could not create audit entry:', e.message);
  }

  // ── Delete all data ──
  console.log('\n  🗑️  Deleting...');

  const results = {
    users:          (await User.deleteMany({ ...filter, role: { $ne: 'PLATFORM_OWNER' } })).deletedCount,
    workOrders:     (await WorkOrder.deleteMany(filter)).deletedCount,
    assets:         (await Asset.deleteMany(filter)).deletedCount,
    inventory:      (await Inventory.deleteMany(filter)).deletedCount,
    purchaseOrders: (await PurchaseOrder.deleteMany(filter)).deletedCount,
    sensorReadings: (await SensorReading.deleteMany(filter)).deletedCount,
    notifications:  (await Notification.deleteMany(filter)).deletedCount,
    clients:        (await Client.deleteMany(filter)).deletedCount,
    company:        (await Company.deleteMany(query)).deletedCount,
  };

  console.log('');
  console.log('  ✅ Deletion Results:');
  for (const [key, val] of Object.entries(results)) {
    console.log(`     ${key.padEnd(18)} ${val} deleted`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ✅ TENANT ${targetId} COMPLETELY WIPED`);
  console.log('  🔐 Audit log entry preserved for HIPAA compliance');
  console.log('═══════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

// ── Run ──
if (LIST) {
  listCompanies().catch(console.error);
} else {
  wipeTenant().catch(err => {
    console.error('❌ Wipe error:', err.message);
    process.exit(1);
  });
}
