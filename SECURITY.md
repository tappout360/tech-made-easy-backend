# Security Policy — Technical Made Easy

## Reporting a Vulnerability

If you discover a security vulnerability in Technical Made Easy, please report it responsibly.

### How to Report

- **Email:** security@technical-made-easy.com
- **Subject Line:** `[SECURITY] Brief description of the vulnerability`
- **Include:**
  - Description of the vulnerability
  - Steps to reproduce
  - Potential impact
  - Any suggested fix (optional)

### What to Expect

| Step | Timeline |
|---|---|
| Acknowledgment of report | Within 48 hours |
| Initial triage and severity assessment | Within 5 business days |
| Status update | Within 14 days |
| Fix deployed (Critical/High) | Within 72 hours of confirmation |
| Fix deployed (Medium/Low) | Within 30 days |
| Public disclosure (coordinated) | After fix is deployed + 30 days |

### Safe Harbor

We consider security research conducted in good faith to be authorized. We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, or service disruption
- Only interact with accounts they own or have explicit permission to test
- Do not exploit a vulnerability beyond what is necessary to confirm it exists
- Report vulnerabilities promptly and do not publicly disclose before a fix is available

### Scope

| In Scope | Out of Scope |
|---|---|
| `*.technical-made-easy.com` | Social engineering of staff |
| Backend API endpoints | Denial of service attacks |
| Authentication and authorization | Physical attacks |
| Data encryption and storage | Third-party services (Stripe, etc.) |
| PHI protection mechanisms | Previously reported vulnerabilities |

### Recognition

We appreciate the security research community. With your permission, we will:
- Credit you in our security advisories
- Add your name to our Security Hall of Fame (if established)

## Supported Versions

| Version | Supported |
|---|---|
| Latest (main branch) | ✅ Active |
| Previous release | ✅ Security patches only |
| Older releases | ❌ Upgrade recommended |

---

## HIPAA Business Associate Agreement (BAA)

> **Technical Made Easy processes Protected Health Information (PHI).**
> A signed BAA is required before any customer deploys this platform with
> patient-related data. Contact legal@technical-made-easy.com for BAA execution.

### BAA-Relevant Technical Controls

| Control | Implementation | Status |
|---|---|---|
| Encryption at Rest | AES-256-GCM via `hipaaStorage.js` (PBKDF2, 310K iterations) | ✅ |
| Encryption in Transit | TLS 1.2+ enforced via HSTS + `enforceHTTPS` | ✅ |
| Access Control | RBAC + 3-Factor MFA + 15-min auto-logoff | ✅ |
| Audit Logging | SHA-256 hash chain, 50+ audit points, CSV export | ✅ |
| Login Lockout | 5 attempts → 15-min lockout | ✅ |
| Data Minimization | PHI auto-scrubbed from integrations/webhooks | ✅ |
| Breach Notification | Coordinated disclosure process (see above) | ✅ |
| Subprocessors | Stripe (PCI DSS), Resend (email), MongoDB Atlas (SOC 2) | ✅ |

---

## Security Scan Results

Last scan: **March 12, 2026** (`npm run security-scan`)

```
═══════════════════════════════════════════════════
 TME Pre-Deployment Security Scan
 IEC 62304 / FDA SPDF Compliance Check
═══════════════════════════════════════════════════

── 1. Dependency Vulnerability Scan (npm audit) ──
   Critical: ✅ 0
   High:     ✅ 0
   Moderate: ✅ 0
   Low:      ✅ 0

── 2. SBOM Freshness Check ──
   Last generated: 2026-03-12
   Age: 0 day(s)
   Components: 12
   Format: CycloneDX v1.5

── 3. Required Security Files ──
   ✅ STRIDE Threat Model
   ✅ Post-Market Cybersecurity Plan
   ✅ Software Bill of Materials
   ✅ Vulnerability Disclosure Policy
   ✅ RFC 9116 security.txt
   ✅ HIPAA Compliance Middleware

── 4. Environment Variable Exposure Check ──
   ✅ .env is in .gitignore
   ✅ No placeholder secrets detected

── 5. Security Middleware Verification ──
   ✅ Security Headers (20+)
   ✅ HTTPS Enforcement
   ✅ Input Sanitization
   ✅ Response Sanitization
   ✅ PHI Access Logging
   ✅ Rate Limiting
   ✅ CORS Configuration
   ✅ Audit Hash Chain Init
   ✅ CSP Header

═══════════════════════════════════════════════════
✅ ALL CHECKS PASSED
═══════════════════════════════════════════════════
```

---

## AI Security (Butler Engine)

Butler AI v2.1 includes **10 security layers**:

| Layer | Protection |
|---|---|
| Role Separation | Immutable system prompt with 10 locked rules |
| Input Delimiters | `<<<USER_INPUT>>>` markers prevent instruction injection |
| Context Control | User input treated as data, never as commands |
| Threat Patterns | 20+ patterns: injection, XSS, exfiltration, multi-lingual |
| Encoding Detection | Base64 decode + re-scan, hex payload detection |
| Homograph Detection | Mixed-script + invisible character attacks |
| LLM Salting | Per-session nonce invalidates pre-computed jailbreaks |
| Anomaly Detection | 3 violations → 5min cooldown, 5 → session lock |
| Governance | 8 high-risk actions require human approval |
| Output Sanitization | Strips leaked system prompts, env vars, tokens |

---

## Example Audit Log Entry

```json
{
  "userId": "6718a3b2c4e5f6a7b8c9d0e1",
  "userName": "Jason Mounts",
  "userRole": "COMPANY",
  "action": "WO_CREATE",
  "target": "WO-2026-0347",
  "detail": "Work order created for Children's Hospital — Sterilizer PM (Annual)",
  "timestamp": "2026-03-12T14:30:00.000Z",
  "ipAddress": "192.168.1.100",
  "hash": "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01",
  "previousHash": "9f8e7d6c5b4a3210fedcba9876543210fedcba9876543210fedcba9876543210",
  "hashChainIntegrity": "VALID"
}
```

Each entry is cryptographically chained (SHA-256) to the previous entry. Tampering with any single record breaks the chain, which is detectable via `verifyAuditIntegrity()`.
