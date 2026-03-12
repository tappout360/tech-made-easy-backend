#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * SBOM Generator — FDA SPDF Compliance
 * Technical Made Easy
 *
 * Generates a CycloneDX-compatible Software Bill of Materials
 * from package.json dependencies. Machine-readable JSON format.
 *
 * Usage: node scripts/generateSBOM.js
 * Output: docs/sbom.json
 * ═══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Read package.json
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

// Read lock file for exact versions if available
let lockDeps = {};
const lockPath = path.join(__dirname, '..', 'package-lock.json');
if (fs.existsSync(lockPath)) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    const packages = lock.packages || {};
    for (const [key, val] of Object.entries(packages)) {
      const name = key.replace('node_modules/', '');
      if (name && val.version) {
        lockDeps[name] = val.version;
      }
    }
  } catch (e) {
    console.warn('Could not parse package-lock.json:', e.message);
  }
}

// Build CycloneDX v1.5 SBOM
const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${crypto.randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{
      vendor: 'Technical Made Easy',
      name: 'tme-sbom-generator',
      version: '1.0.0',
    }],
    component: {
      type: 'application',
      name: pkg.name,
      version: pkg.version || '1.0.0',
      description: pkg.description || '',
      author: pkg.author || 'Technical Made Easy',
      licenses: pkg.license ? [{ license: { id: pkg.license } }] : [],
    },
    supplier: {
      name: 'Technical Made Easy',
      url: ['https://www.technical-made-easy.com'],
    },
  },
  components: [],
};

// Add production dependencies
function addDeps(deps, scope) {
  if (!deps) return;
  for (const [name, versionRange] of Object.entries(deps)) {
    const exactVersion = lockDeps[name] || versionRange.replace(/[\^~>=<]/g, '');
    sbom.components.push({
      type: 'library',
      name,
      version: exactVersion,
      scope: scope,
      purl: `pkg:npm/${name}@${exactVersion}`,
      'bom-ref': `pkg:npm/${name}@${exactVersion}`,
    });
  }
}

addDeps(pkg.dependencies, 'required');
addDeps(pkg.devDependencies, 'optional');

// Ensure output directory
const outDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, 'sbom.json');
fs.writeFileSync(outPath, JSON.stringify(sbom, null, 2), 'utf-8');

console.log(`✅ SBOM generated: ${outPath}`);
console.log(`   Format: CycloneDX v1.5`);
console.log(`   Components: ${sbom.components.length}`);
console.log(`     Production: ${Object.keys(pkg.dependencies || {}).length}`);
console.log(`     Development: ${Object.keys(pkg.devDependencies || {}).length}`);
console.log(`   Serial: ${sbom.serialNumber}`);
