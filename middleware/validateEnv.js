/**
 * Environment Validation — Runs on server startup
 * Ensures all required environment variables are set and
 * catches common mistakes (placeholder values, weak secrets).
 *
 * HIPAA §164.312(a)(1) — Access Control / Technical Safeguards
 */

const REQUIRED_VARS = [
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
];

const OPTIONAL_VARS = [
  'GOOGLE_MAPS_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'QB_CLIENT_ID',
  'QB_CLIENT_SECRET',
  'FRONTEND_URL',
];

// Patterns that indicate a placeholder was left in .env
const PLACEHOLDER_PATTERNS = [
  /^REPLACE_ME$/i,
  /^YOUR_.*_HERE$/i,
  /^<.*>$/,
  /^TODO$/i,
  /^CHANGEME$/i,
  /^super_secret/i,
  /^password$/i,
  /^secret$/i,
];

function validateEnv() {
  const errors = [];
  const warnings = [];

  // ── Check required variables ──
  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      errors.push(`❌ Missing required env var: ${key}`);
    }
  }

  // ── Check for placeholder values ──
  for (const key of [...REQUIRED_VARS, ...OPTIONAL_VARS]) {
    const val = process.env[key];
    if (!val) continue;

    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(val)) {
        errors.push(`❌ ${key} contains a placeholder value — update it in .env`);
        break;
      }
    }
  }

  // ── JWT secret strength check ──
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push('❌ JWT_SECRET is too short (min 32 chars). Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  }

  // ── MongoDB URI format check ──
  if (process.env.MONGO_URI && !process.env.MONGO_URI.startsWith('mongodb')) {
    errors.push('❌ MONGO_URI does not look like a valid MongoDB connection string');
  }

  // ── Optional variable warnings ──
  for (const key of OPTIONAL_VARS) {
    if (!process.env[key] || process.env[key] === 'REPLACE_ME') {
      warnings.push(`⚠️  ${key} not configured — related features will be disabled`);
    }
  }

  // ── Output results ──
  if (warnings.length > 0) {
    console.log('\n🔧 Environment Warnings:');
    warnings.forEach(w => console.log(`   ${w}`));
  }

  if (errors.length > 0) {
    console.error('\n🚨 ENVIRONMENT VALIDATION FAILED:');
    errors.forEach(e => console.error(`   ${e}`));
    console.error('\n   Fix the above issues in your .env file.');
    console.error('   See .env.example for the required format.\n');

    if (process.env.NODE_ENV === 'production') {
      process.exit(1); // Hard fail in production
    }
  } else {
    console.log('✅ Environment validation passed');
  }
}

module.exports = validateEnv;
