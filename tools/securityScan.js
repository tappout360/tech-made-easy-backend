#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * Security Scan — Pre-Deployment Vulnerability Check
 * Technical Made Easy — IEC 62304 / FDA SPDF Compliance
 *
 * Runs automated security checks:
 *   1. npm audit (dependency vulnerabilities)
 *   2. SBOM freshness check
 *   3. Security header validation
 *   4. Environment variable exposure check
 *
 * Usage: node scripts/securityScan.js
 * ═══════════════════════════════════════════════════════════════════
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️';
let exitCode = 0;

console.log('═══════════════════════════════════════════════════');
console.log(' TME Pre-Deployment Security Scan');
console.log(' IEC 62304 / FDA SPDF Compliance Check');
console.log('═══════════════════════════════════════════════════\n');

// ── 1. npm audit ──
console.log('── 1. Dependency Vulnerability Scan (npm audit) ──\n');
try {
  const auditOutput = execSync('npm audit --json 2>&1', { encoding: 'utf-8', cwd: path.join(__dirname, '..') });
  const audit = JSON.parse(auditOutput);
  const vulns = audit.metadata?.vulnerabilities || {};
  const critical = vulns.critical || 0;
  const high = vulns.high || 0;
  const moderate = vulns.moderate || 0;
  const low = vulns.low || 0;

  console.log(`   Critical: ${critical === 0 ? PASS : FAIL} ${critical}`);
  console.log(`   High:     ${high === 0 ? PASS : FAIL} ${high}`);
  console.log(`   Moderate: ${moderate === 0 ? PASS : WARN} ${moderate}`);
  console.log(`   Low:      ${PASS} ${low}`);

  if (critical > 0 || high > 0) {
    console.log(`\n   ${FAIL} BLOCKING: ${critical} critical, ${high} high vulnerabilities found.`);
    console.log('   Run "npm audit fix" or update affected packages.\n');
    exitCode = 1;
  } else {
    console.log(`\n   ${PASS} Dependency scan passed.\n`);
  }
} catch (e) {
  // npm audit returns non-zero when vulns found
  try {
    const audit = JSON.parse(e.stdout || '{}');
    const vulns = audit.metadata?.vulnerabilities || {};
    console.log(`   Critical: ${vulns.critical || 0}, High: ${vulns.high || 0}, Moderate: ${vulns.moderate || 0}`);
    if ((vulns.critical || 0) > 0 || (vulns.high || 0) > 0) {
      console.log(`   ${FAIL} BLOCKING vulnerabilities found.\n`);
      exitCode = 1;
    }
  } catch {
    console.log(`   ${WARN} Could not parse npm audit output.\n`);
  }
}

// ── 2. SBOM Freshness ──
console.log('── 2. SBOM Freshness Check ──\n');
const sbomPath = path.join(__dirname, '..', 'docs', 'sbom.json');
if (fs.existsSync(sbomPath)) {
  const sbom = JSON.parse(fs.readFileSync(sbomPath, 'utf-8'));
  const sbomDate = new Date(sbom.metadata?.timestamp);
  const daysSinceUpdate = Math.floor((Date.now() - sbomDate.getTime()) / (1000 * 60 * 60 * 24));

  console.log(`   Last generated: ${sbomDate.toISOString()}`);
  console.log(`   Age: ${daysSinceUpdate} day(s)`);
  console.log(`   Components: ${sbom.components?.length || 0}`);
  console.log(`   Format: ${sbom.bomFormat} v${sbom.specVersion}`);

  if (daysSinceUpdate > 30) {
    console.log(`\n   ${WARN} SBOM is ${daysSinceUpdate} days old. Regenerate with: npm run sbom\n`);
  } else {
    console.log(`\n   ${PASS} SBOM is current.\n`);
  }
} else {
  console.log(`   ${FAIL} No SBOM found at docs/sbom.json. Run: npm run sbom\n`);
  exitCode = 1;
}

// ── 3. Required Security Files ──
console.log('── 3. Required Security Files ──\n');
const requiredFiles = [
  { path: 'docs/THREAT_MODEL.md', name: 'STRIDE Threat Model' },
  { path: 'docs/POST_MARKET_CYBERSECURITY_PLAN.md', name: 'Post-Market Cybersecurity Plan' },
  { path: 'docs/sbom.json', name: 'Software Bill of Materials' },
  { path: 'SECURITY.md', name: 'Vulnerability Disclosure Policy' },
  { path: 'public/security.txt', name: 'RFC 9116 security.txt' },
  { path: 'middleware/hipaaCompliance.js', name: 'HIPAA Compliance Middleware' },
];

for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, '..', file.path);
  const exists = fs.existsSync(fullPath);
  console.log(`   ${exists ? PASS : FAIL} ${file.name} (${file.path})`);
  if (!exists) exitCode = 1;
}
console.log();

// ── 4. Environment Variable Exposure Check ──
console.log('── 4. Environment Variable Exposure Check ──\n');
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf-8');
  const exposedInGit = fs.existsSync(path.join(__dirname, '..', '.gitignore'));
  
  // Check .gitignore includes .env
  if (exposedInGit) {
    const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf-8');
    if (gitignore.includes('.env')) {
      console.log(`   ${PASS} .env is in .gitignore`);
    } else {
      console.log(`   ${FAIL} .env is NOT in .gitignore — CRITICAL!`);
      exitCode = 1;
    }
  }

  // Check for placeholder/weak secrets
  if (envContent.includes('changeme') || envContent.includes('password123') || envContent.includes('secret123')) {
    console.log(`   ${FAIL} .env contains placeholder/weak secrets`);
    exitCode = 1;
  } else {
    console.log(`   ${PASS} No placeholder secrets detected`);
  }
} else {
  console.log(`   ${WARN} No .env file found (expected in development)`);
}
console.log();

// ── 5. Security Middleware Check ──
console.log('── 5. Security Middleware Verification ──\n');
const serverPath = path.join(__dirname, '..', 'server.js');
if (fs.existsSync(serverPath)) {
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  const checks = [
    { pattern: 'securityHeaders', name: 'Security Headers' },
    { pattern: 'enforceHTTPS', name: 'HTTPS Enforcement' },
    { pattern: 'sanitizeInput', name: 'Input Sanitization' },
    { pattern: 'sanitizeResponse', name: 'Response Sanitization' },
    { pattern: 'logPHIAccess', name: 'PHI Access Logging' },
    { pattern: 'rateLimit', name: 'Rate Limiting' },
    { pattern: 'cors', name: 'CORS Configuration' },
    { pattern: 'initHashChain', name: 'Audit Hash Chain Init' },
    { pattern: 'Content-Security-Policy', name: 'CSP Header', file: 'middleware/hipaaCompliance.js' },
  ];

  for (const chk of checks) {
    const checkFile = chk.file ? path.join(__dirname, '..', chk.file) : serverPath;
    const content = fs.existsSync(checkFile) ? fs.readFileSync(checkFile, 'utf-8') : '';
    const found = content.includes(chk.pattern) || serverContent.includes(chk.pattern);
    console.log(`   ${found ? PASS : FAIL} ${chk.name}`);
    if (!found) exitCode = 1;
  }
}
console.log();

// ── Summary ──
console.log('═══════════════════════════════════════════════════');
if (exitCode === 0) {
  console.log(`${PASS} ALL CHECKS PASSED — Ready for deployment review`);
} else {
  console.log(`${FAIL} ISSUES FOUND — Resolve before deployment`);
}
console.log('═══════════════════════════════════════════════════\n');

process.exit(exitCode);
