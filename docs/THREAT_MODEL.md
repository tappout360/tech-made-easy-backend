<!-- 
  ═══════════════════════════════════════════════════════════════════
  STRIDE THREAT MODEL — Technical Made Easy  
  FDA Secure Product Development Framework (SPDF) Compliance
  ─────────────────────────────────────────────────────────────────
  Document Version: 1.0
  Date: 2026-03-12
  Classification: CONFIDENTIAL — Internal Use Only
  ═══════════════════════════════════════════════════════════════════
-->

# STRIDE Threat Model — Technical Made Easy

**Document ID:** TME-TM-2026-001  
**Version:** 1.0  
**Date:** March 12, 2026  
**Author:** Technical Made Easy Security Team  
**Classification:** CONFIDENTIAL — Internal Use Only

---

## 1. System Overview

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARY                        │
│  ┌──────────────┐    HTTPS/TLS    ┌──────────────────┐  │
│  │   Frontend   │◄──────────────►│   Backend API    │  │
│  │  React PWA   │                 │  Express.js      │  │
│  │  (Browser)   │                 │  Node.js         │  │
│  └──────────────┘                 └────────┬─────────┘  │
│                                            │             │
│                                   ┌────────▼─────────┐  │
│                                   │   MongoDB Atlas  │  │
│                                   │   (Encrypted)    │  │
│                                   └──────────────────┘  │
│                                                          │
│  ┌──────────────┐                 ┌──────────────────┐  │
│  │ 3rd Party    │                 │  Email Service   │  │
│  │ Integrations │                 │  (Resend)        │  │
│  │ QB/Stripe    │                 └──────────────────┘  │
│  └──────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

### Data Classification
| Category | Examples | Sensitivity |
|---|---|---|
| PHI | Patient names, equipment linked to patients | 🔴 Critical |
| PII | Employee names, emails, phones | 🟡 High |
| Business | Work orders, invoices, parts data | 🟢 Medium |
| Public | Landing page, pricing | ⚪ Low |

### Entry Points
1. **Frontend SPA** — React PWA served via Vercel CDN
2. **REST API** — Express.js on port 5000 behind reverse proxy
3. **WebSocket** — Real-time notifications (future)
4. **Third-party OAuth** — QuickBooks, Google Calendar
5. **File Upload** — AI Document Ingestor (client-side only)

---

## 2. STRIDE Analysis

### S — Spoofing (Identity)

| ID | Threat | Risk | Mitigation | Test Evidence |
|---|---|---|---|---|
| S-1 | Stolen JWT used to impersonate user | 🔴 High | JWT expiration, HTTPS-only transport, `HttpOnly` cookie flag | `middleware.test.js` — rejects invalid tokens |
| S-2 | Brute force login | 🟡 Medium | 5-attempt lockout (30min), rate limiting (20/15min) | `hipaaCompliance.test.js` — lockout tests |
| S-3 | Session hijacking | 🟡 Medium | Unique `sessionId` per login, PHI access tied to session | `generateSessionId()` in middleware |
| S-4 | OAuth token theft | 🟡 Medium | CSRF state param on QuickBooks OAuth flow | QuickBooks route CSRF protection |

### T — Tampering (Data Integrity)

| ID | Threat | Risk | Mitigation | Test Evidence |
|---|---|---|---|---|
| T-1 | NoSQL injection modifying queries | 🔴 High | `deepSanitizeInput()` strips `$` operators | `hipaaCompliance.test.js` — injection tests |
| T-2 | XSS injecting malicious scripts | 🔴 High | `stripDangerousTags()` removes script/iframe/event handlers | XSS sanitization tests |
| T-3 | Audit log manipulation | 🟡 Medium | SHA-256 hash chain, tamper-evident sequence | `initHashChain()`, `computeAuditHash()` |
| T-4 | Electronic signature forgery | 🟡 Medium | FDA 21 CFR Part 11 validation (signedBy, signedAt required) | `validateElectronicSignature()` middleware |

### R — Repudiation (Accountability)

| ID | Threat | Risk | Mitigation | Test Evidence |
|---|---|---|---|---|
| R-1 | User denies performing action | 🟡 Medium | HIPAA audit log with user ID, timestamp, IP, session | `logPHIAccess` middleware, `auditLogger.js` |
| R-2 | Audit log tampering | 🟡 Medium | Hash chain integrity (SHA-256 linked blocks) | `computeAuditHash()` — genesis block → chain |
| R-3 | Missing PHI access records | 🟢 Low | Automatic PHI endpoint detection + async log writes | `logPHIAccess` auto-detects PHI routes |

### I — Information Disclosure

| ID | Threat | Risk | Mitigation | Test Evidence |
|---|---|---|---|---|
| I-1 | Secrets in API responses | 🔴 High | `sanitizeResponse()` strips password, tokens, keys | `deepStripSecrets()` — SENSITIVE_FIELDS set |
| I-2 | Error stack traces in production | 🟡 Medium | Stack trace removal in production mode | `sanitizeResponse` middleware |
| I-3 | PHI leakage via AI processing | 🔴 High | Client-side only document processing (no PHI to server) | `documentIngestor.js` — browser-only |
| I-4 | PHI in referrer headers | 🟢 Low | `Referrer-Policy: strict-origin-when-cross-origin` | Security headers middleware |
| I-5 | Server fingerprinting | 🟢 Low | `X-Powered-By` header removed | `securityHeaders()` middleware |
| I-6 | PHI cached in browser | 🟡 Medium | `Cache-Control: no-store` on API responses | Security headers + cache middleware |

### D — Denial of Service

| ID | Threat | Risk | Mitigation | Test Evidence |
|---|---|---|---|---|
| D-1 | API flood | 🟡 Medium | Rate limiting: 200 req/15min (API), 20/15min (auth) | `api.test.js` — rate limit headers |
| D-2 | Large payload attacks | 🟢 Low | `express.json({ limit: '10mb' })` body size cap | `server.js` line 61 |
| D-3 | Resource exhaustion via file upload | 🟢 Low | Client-side file processing only | `documentIngestor.js` |

### E — Elevation of Privilege

| ID | Threat | Risk | Mitigation | Test Evidence |
|---|---|---|---|---|
| E-1 | Tech accessing office-only endpoints | 🟡 Medium | `requireRole()` RBAC middleware | `middleware.test.js` — role enforcement |
| E-2 | Client accessing PHI of other clients | 🟡 Medium | Company-scoped data isolation in queries | Route-level `companyId` filtering |
| E-3 | Demo user accessing production data | 🟢 Low | Demo mode uses localStorage/IndexedDB only | Frontend `WorkOrderContext.jsx` |

---

## 3. Trust Boundaries

```
BOUNDARY 1: Browser ↔ API Server
├── Control: CORS whitelist (6 origins)
├── Control: HTTPS enforcement (HSTS)
├── Control: JWT Bearer tokens
└── Control: Rate limiting

BOUNDARY 2: API Server ↔ MongoDB
├── Control: TLS encryption (Atlas)
├── Control: IP whitelisting
├── Control: Connection string via env vars
└── Control: NoSQL injection sanitization

BOUNDARY 3: API Server ↔ External Services
├── Control: OAuth 2.0 (QuickBooks)
├── Control: API keys via env vars
├── Control: CSRF state tokens (OAuth flows)
└── Control: Response validation
```

---

## 4. Risk Matrix

| Risk Level | Count | Action Required |
|---|---|---|
| 🔴 Critical (9-10) | 0 | Immediate remediation |
| 🔴 High (7-8) | 5 | All mitigated ✅ |
| 🟡 Medium (4-6) | 13 | All mitigated ✅ |
| 🟢 Low (1-3) | 6 | Accepted risk ✅ |

**Residual Risk:** All identified threats have active mitigations in place. No unmitigated critical or high-risk threats remain.

---

## 5. SBOM Reference

Machine-readable SBOMs are maintained at:
- **Backend:** `docs/sbom.json` (CycloneDX v1.5)
- **Frontend:** `docs/sbom.json` (CycloneDX v1.5)

Regenerate: `node scripts/generateSBOM.js`

---

## 6. Verification Plan

| Control | Verification Method | Frequency |
|---|---|---|
| Authentication | Unit tests (`middleware.test.js`) | Every commit |
| HIPAA compliance | Integration tests (`hipaaCompliance.test.js`) | Every commit |
| Rate limiting | API tests (`api.test.js`) | Every commit |
| Dependency vulnerabilities | `npm audit` | Weekly |
| SBOM regeneration | `node scripts/generateSBOM.js` | Every release |
| Penetration testing | OWASP ZAP scan | Quarterly |

---

**Document Status:** ✅ Complete  
**Next Review Date:** June 12, 2026
