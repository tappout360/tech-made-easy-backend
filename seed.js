#!/usr/bin/env node
// ============================================================
//  DATABASE SEED SCRIPT — PLATFORM OWNER + DEMO COMPANIES
//  Technical Made Easy
//
//  Creates:
//  1. Jason Mounts (PLATFORM_OWNER) — supreme admin
//  2. Demo companies with account numbers
//  3. Sample users per company
//
//  Usage:
//    node seed.js              (seed everything)
//    node seed.js --owner-only (seed only PLATFORM_OWNER)
//    node seed.js --reset      (drop users collection first)
//
//  HIPAA Note: Emergency access code is displayed ONCE on
//  first run. Store it securely — it's hashed in the DB.
// ============================================================

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const User     = require('./models/User');

// ── Configuration ────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env — cannot connect.');
  process.exit(1);
}

const args = process.argv.slice(2);
const OWNER_ONLY = args.includes('--owner-only');
const RESET      = args.includes('--reset');

// ── Generate a secure emergency code ─────────────────────────
function generateEmergencyCode() {
  // 32-char alphanumeric code
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

// ── PLATFORM OWNER ───────────────────────────────────────────
const PLATFORM_OWNER = {
  role: 'PLATFORM_OWNER',
  name: 'Jason Mounts',
  email: 'Tappout360',
  password: 'JakylieTechnical$$',
  companyId: null,
  accountNumber: null,
  avatar: 'JM',
  platformOwner: true,
  companyAccountNumber: null,
  preferences: {},
  active: true,
  passwordExpiryDays: 90,
};

// ── DEMO COMPANIES & USERS ──────────────────────────────────
const SEED_USERS = [
  // ── BiomediCorp (c1) ──
  { role: 'COMPANY', name: 'Dr. Rachel Green', email: 'rachel@biomedicorp.com', password: 'BioMed#C1-2026!', companyId: 'c1', companyAccountNumber: 'TME-C-0001', avatar: 'RG' },
  { role: 'COMPANY', name: 'Team Technical',   email: 'TeamTechnical',           password: 'Jakylietotal4388$$', companyId: 'c1', companyAccountNumber: 'TME-C-0001', avatar: 'TT' },
  { role: 'ADMIN',   name: 'Marcus Webb',      email: 'marcus@biomedicorp.com', password: 'Webb@Admin-4491', companyId: 'c1', companyAccountNumber: 'TME-C-0001', avatar: 'MW' },
  { role: 'OFFICE',  name: 'Lisa Park',        email: 'lisa@biomedicorp.com',   password: 'Park$Office2026', companyId: 'c1', companyAccountNumber: 'TME-C-0001', avatar: 'LP' },
  { role: 'TECH',    name: 'Carlos Reyes',     email: 'carlos@biomedicorp.com', password: 'Reyes!Tech-7823', companyId: 'c1', companyAccountNumber: 'TME-C-0001', avatar: 'CR' },
  { role: 'TECH',    name: 'Sarah Chen',       email: 'sarah@biomedicorp.com',  password: 'Chen$Tech-2145',  companyId: 'c1', companyAccountNumber: 'TME-C-0001', avatar: 'SC' },
  { role: 'CLIENT',  name: 'Memorial Hospital', email: 'admin@memorial.org',   password: 'Memorial#Cl2026', companyId: 'c1', accountNumber: 'TME-CL-0001', companyAccountNumber: 'TME-C-0001', avatar: 'MH' },

  // ── MedServ Solutions (c2) ──
  { role: 'COMPANY', name: 'Tom Bradley',      email: 'tom@medserv.com',       password: 'MedServ#C2-2026', companyId: 'c2', companyAccountNumber: 'TME-C-0002', avatar: 'TB' },
  { role: 'TECH',    name: 'James Foster',     email: 'james@medserv.com',     password: 'Foster!Tech9012', companyId: 'c2', companyAccountNumber: 'TME-C-0002', avatar: 'JF' },
  { role: 'CLIENT',  name: 'St. Luke Clinic',  email: 'admin@stluke.org',      password: 'StLuke#Client26', companyId: 'c2', accountNumber: 'TME-CL-0002', companyAccountNumber: 'TME-C-0002', avatar: 'SL' },
];

// ── Main Seed Function ───────────────────────────────────────
async function seed() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  TECHNICAL MADE EASY — Database Seed Script');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  try {
    // Connect
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');
    console.log('');

    // Reset if requested
    if (RESET) {
      console.log('⚠️  --reset flag detected. Dropping all users...');
      await User.deleteMany({});
      console.log('✅ All users removed.');
      console.log('');
    }

    // ── 1. Create PLATFORM_OWNER ────────────────────────────
    console.log('👑 Creating PLATFORM_OWNER: Jason Mounts...');
    
    const existingOwner = await User.findOne({ email: PLATFORM_OWNER.email });
    let emergencyCode;

    if (existingOwner) {
      console.log('   ⚡ User already exists — updating to PLATFORM_OWNER role...');
      existingOwner.role = 'PLATFORM_OWNER';
      existingOwner.platformOwner = true;
      existingOwner.name = PLATFORM_OWNER.name;
      existingOwner.active = true;

      // Generate new emergency code
      emergencyCode = generateEmergencyCode();
      existingOwner.emergencyAccessCode = await bcrypt.hash(emergencyCode, 12);
      
      await existingOwner.save();
      console.log('   ✅ Updated existing user to PLATFORM_OWNER');
    } else {
      emergencyCode = generateEmergencyCode();
      const hashedEmergencyCode = await bcrypt.hash(emergencyCode, 12);

      const owner = new User({
        ...PLATFORM_OWNER,
        emergencyAccessCode: hashedEmergencyCode,
      });
      await owner.save();
      console.log('   ✅ Created PLATFORM_OWNER account');
    }

    // Display emergency code — SHOW ONCE ONLY
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  🚨 EMERGENCY ACCESS CODE — SAVE THIS SECURELY 🚨  ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Code: ${emergencyCode}                        ║`);
    console.log('║                                                      ║');
    console.log('║  This code is your backup login if primary auth      ║');
    console.log('║  fails. It is hashed in the database and CANNOT      ║');
    console.log('║  be recovered. Store in a secure location.           ║');
    console.log('║                                                      ║');
    console.log('║  Use: POST /api/v1/platform/emergency-access         ║');
    console.log('║  Body: { "email": "Tappout360",                      ║');
    console.log('║          "emergencyCode": "<this code>" }            ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    // ── 2. Create Demo Users (unless --owner-only) ──────────
    if (!OWNER_ONLY) {
      console.log('👥 Creating demo company users...');
      let created = 0;
      let skipped = 0;

      for (const userData of SEED_USERS) {
        const exists = await User.findOne({ email: userData.email });
        if (exists) {
          console.log(`   ⏭️  ${userData.name} (${userData.email}) — already exists`);
          skipped++;
          continue;
        }

        const user = new User({
          ...userData,
          preferences: {},
          active: true,
          passwordExpiryDays: 90,
        });
        await user.save();
        console.log(`   ✅ ${userData.role.padEnd(10)} ${userData.name} (${userData.companyId || 'global'})`);
        created++;
      }

      console.log('');
      console.log(`   📊 Results: ${created} created, ${skipped} skipped (existing)`);
    }

    // ── 3. Summary ──────────────────────────────────────────
    const totalUsers = await User.countDocuments();
    const owners = await User.countDocuments({ role: 'PLATFORM_OWNER' });
    const companies = await User.distinct('companyId', { companyId: { $ne: null } });

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('  ✅ SEED COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Total users in DB:   ${totalUsers}`);
    console.log(`  Platform owners:     ${owners}`);
    console.log(`  Companies:           ${companies.length} (${companies.join(', ')})`);
    console.log('');
    console.log('  🔐 Login credentials:');
    console.log('     Email:    Tappout360');
    console.log('     Password: JakylieTechnical$$');
    console.log('     Role:     PLATFORM_OWNER (Level 0)');
    console.log('');
    console.log('  🛡️ HIPAA: All passwords hashed with bcrypt-12.');
    console.log('       Emergency code hashed separately.');
    console.log('       Audit log: PLATFORM_OWNER_SEEDED');
    console.log('═══════════════════════════════════════════════════');
    console.log('');

  } catch (err) {
    console.error('');
    console.error('❌ SEED ERROR:', err.message);
    if (err.code === 11000) {
      console.error('   Duplicate key — a user with that email already exists.');
      console.error('   Run with --reset to clear first, or --owner-only to update.');
    }
    console.error('');
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  }
}

// Run
seed();
