# Pre-Deployment Testing Plan — IEC 62304 Compliance

**Document ID:** TME-TEST-2026-001  
**Version:** 1.0  
**Date:** March 12, 2026  
**Classification:** CONFIDENTIAL — Internal Use Only  
**Software Safety Class:** Class B (per IEC 62304 — non-life-sustaining, could contribute to hazard)

---

## 1. Performance & Scalability Testing

### 1.1 Load Testing

| Scenario | Expected Load | Peak Load | Tool |
|---|---|---|---|
| Dashboard page load | 50 concurrent users | 200 concurrent | k6 |
| Work order CRUD | 30 req/sec | 100 req/sec | k6 |
| API authentication | 20 logins/min | 60 logins/min | k6 |
| Real-time notifications | 100 WebSocket connections | 500 | k6 |
| Audit log writes | 50 writes/sec | 200 writes/sec | k6 |

**Script:** `tests/load/load-test.js` (k6)  
**Run:** `k6 run tests/load/load-test.js`  
**Pass criteria:** p95 response time < 500ms, error rate < 1%

### 1.2 Stress Testing

| Test | Method | Breaking Point Goal |
|---|---|---|
| API flood | Ramp to 1000 req/sec | Find HTTP 503 threshold |
| DB connection exhaustion | Exceed MongoDB pool limit | Measure recovery time |
| Memory pressure | Large payload uploads | Identify OOM boundary |

**Pass criteria:** System recovers within 30 seconds of load dropping below threshold

### 1.3 Endurance (Soak) Testing

| Duration | Load | Metrics Monitored |
|---|---|---|
| 12 hours | 50% peak | Memory usage (no leak > 5MB/hr) |
| 24 hours | 25% peak | Response time (no degradation > 10%) |

**Pass criteria:** Memory stable, no response time increase > 10%, zero crashes

---

## 2. Security & Compliance Testing

### 2.1 Automated Vulnerability Scanning

| Tool | Target | Frequency |
|---|---|---|
| `npm audit` | Backend dependencies (10 prod) | Every build |
| `npm audit` | Frontend dependencies (8 prod) | Every build |
| OWASP ZAP | API endpoints | Pre-release |
| SBOM scan | CycloneDX SBOM vs NVD | Weekly |

**Script:** `scripts/securityScan.js`  
**Run:** `node scripts/securityScan.js`

### 2.2 Penetration Testing Checklist

| Category | Test | OWASP Ref |
|---|---|---|
| Authentication | Brute force login (should lock at 5 attempts) | A07:2021 |
| Authentication | JWT manipulation (expired, tampered, stolen) | A07:2021 |
| Authorization | Horizontal privilege escalation (tech → other company) | A01:2021 |
| Authorization | Vertical privilege escalation (tech → admin) | A01:2021 |
| Injection | NoSQL injection via query params | A03:2021 |
| Injection | XSS via work order description field | A03:2021 |
| Injection | AI prompt injection via Butler chatbox | A03:2021 |
| Data exposure | API response contains password/token | A02:2021 |
| Data exposure | Error responses leak stack traces | A05:2021 |
| Rate limiting | Auth endpoint respects 20/15min limit | A04:2021 |
| CORS | Cross-origin request from unauthorized domain | A05:2021 |

**Vendor:** Third-party ethical hacker (scheduled per POST_MARKET_CYBERSECURITY_PLAN.md)

### 2.3 Compliance Validation Matrix

| Control | Regulation | Verification Method | Status |
|---|---|---|---|
| AES-256-GCM encryption at rest | HIPAA §164.312(a)(2)(iv) | `hipaaStorage.js` unit test | ✅ |
| TLS 1.2+ in transit | HIPAA §164.312(e)(1) | HSTS header + `enforceHTTPS` | ✅ |
| MFA on login | HIPAA §164.312(d) | `mfaService.js` integration test | ✅ |
| Auto-logoff (15min) | HIPAA §164.312(a)(2)(iii) | `SessionTimeoutModal` E2E test | ✅ |
| Audit logging | HIPAA §164.312(b) | `auditLogger.js` + hash chain | ✅ |
| Password policy (12+ chars) | HIPAA §164.308(a)(5)(ii)(D) | `hipaaCompliance.test.js` | ✅ |
| Login lockout (5 attempts) | HIPAA §164.312(a)(1) | `hipaaCompliance.test.js` | ✅ |
| SBOM maintained | FDA SPDF §5.4 | `docs/sbom.json` (CycloneDX) | ✅ |
| Threat model documented | FDA SPDF §5.1 | `docs/THREAT_MODEL.md` | ✅ |
| CycloneDX e-signatures | FDA 21 CFR Part 11 | `validateElectronicSignature()` | ✅ |

---

## 3. Interoperability & Integration Testing

### 3.1 Third-Party Integration Matrix

| Integration | Protocol | Test Method | Verified |
|---|---|---|---|
| QuickBooks | REST API + OAuth 2.0 | Demo mode connected + CSRF test | ✅ |
| Stripe | REST API + Webhooks | Payment lifecycle test | ✅ |
| Resend (Email) | REST API | MFA email delivery test | ✅ |
| Google Calendar | REST API + OAuth | Sync calendar events test | ⬜ |
| Salesforce | REST API | Contact sync test | ⬜ |
| SAP | REST API | Work order sync test | ⬜ |
| ServiceNow | REST API | Ticket creation test | ⬜ |
| DocuSign | REST API | E-signature flow test | ⬜ |

### 3.2 Device/Sensor Data Testing

| Test | Method | Pass Criteria |
|---|---|---|
| Sensor data ingestion | Simulate IoT payload to `/api/v1/sensors` | Data stored within 100ms |
| Real-time display | Push sensor data, verify dashboard update | UI updates within 2 seconds |
| Data integrity | Compare sent vs stored values | Zero data corruption |
| Offline sync | Queue data offline, verify sync on reconnect | All queued data synced correctly |

### 3.3 Standards Compliance (Future)

| Standard | Purpose | Implementation Status |
|---|---|---|
| HL7 FHIR | Healthcare data exchange | 🟡 Planned (v2.0) |
| DICOM | Medical imaging | ⬜ Not applicable |
| IHE profiles | Integration testing framework | 🟡 Planned |

---

## 4. Final Validation Gates

### 4.1 Automated Regression Testing

| Suite | Tool | Commands | Coverage |
|---|---|---|---|
| Backend API tests | Jest + Supertest | `npm test` | Auth, HIPAA, API |
| Frontend unit tests | Vitest + Testing Library | `npm test` | Components, hooks |
| Frontend coverage | Vitest coverage | `npm run test:coverage` | Target: 70%+ |
| Build verification | Vite | `npm run build` | Zero errors |
| Lint check | ESLint | `npm run lint` | Zero errors |
| Format check | Prettier | `npm run format:check` | Consistent |

**Pre-merge checklist:**
```
[ ] npm test (backend)
[ ] npm test (frontend)
[ ] npm run build (zero errors)
[ ] npm run lint (zero warnings)
[ ] npm audit (zero critical/high)
```

### 4.2 User Acceptance Testing (UAT) Protocol

| Role | Scenario | Expected Outcome |
|---|---|---|
| **Tech** | Complete work order from assignment to close-out | All fields save, photos attach, signature captures |
| **Tech** | Request parts → receive approval → finish WO | Parts approval flow completes end-to-end |
| **Office** | Create WO → dispatch to tech → receive completed → invoice | Full lifecycle from creation to payment |
| **Office** | Bulk PM scheduling for 50 assets | PMs created and assigned within 60 seconds |
| **Client** | Submit service request → track progress → pay invoice | Client portal workflow end-to-end |
| **Client** | View equipment inventory with QR scan | QR scanner opens asset detail correctly |
| **Owner** | Review company analytics dashboard | All charts render with correct data |
| **Owner** | Run compliance check → export audit logs | CSV export includes hash chain |

**UAT participants:** 2-3 actual biomedical technicians, 1 office manager, 1 client rep  
**UAT duration:** 3-5 business days  
**UAT sign-off:** Written approval from each participant role

### 4.3 Static Code Analysis

| Tool | Purpose | Configuration |
|---|---|---|
| ESLint | Code style + error detection | `eslint.config.js` (configured) |
| Prettier | Formatting consistency | `.prettierrc` (configured) |
| Husky + lint-staged | Pre-commit hooks | `package.json` (configured) |
| `npm audit` | Dependency vulnerability check | CI/CD integration |

---

## 5. Test Execution Schedule

| Phase | Tests | Duration | Dependencies |
|---|---|---|---|
| **Phase 1: Automated** | Regression, lint, build, npm audit | 1 day | None |
| **Phase 2: Load/Stress** | k6 load, stress, soak tests | 2-3 days | Staging env |
| **Phase 3: Security** | Pen test, vulnerability scan, compliance check | 1-2 weeks | Third-party vendor |
| **Phase 4: Integration** | 3rd party APIs, device sync | 3-5 days | Integration credentials |
| **Phase 5: UAT** | Clinician/staff testing | 3-5 days | Real users |
| **Phase 6: Sign-off** | Final review + documentation | 1 day | All phases pass |

**Total estimated time: 4-6 weeks**

---

## 6. Release Criteria

All of the following must be TRUE before production deployment:

- [ ] All automated regression tests pass (100%)
- [ ] Build completes with zero errors
- [ ] npm audit shows 0 critical, 0 high vulnerabilities
- [ ] k6 load test: p95 < 500ms at expected load
- [ ] Soak test: 12hrs with no memory leak > 5MB/hr
- [ ] Penetration test: No unmitigated critical/high findings
- [ ] SBOM regenerated and reviewed
- [ ] All HIPAA compliance controls verified
- [ ] UAT sign-off from all participant roles
- [ ] THREAT_MODEL.md and POST_MARKET_CYBERSECURITY_PLAN.md current

---

**Document Status:** ✅ Complete  
**Approved By:** ______________________  
**Date:** ______________________
