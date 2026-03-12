# Post-Market Cybersecurity Monitoring Plan

**Document ID:** TME-PMCM-2026-001  
**Version:** 1.0  
**Date:** March 12, 2026  
**Author:** Technical Made Easy Security Team  
**Classification:** CONFIDENTIAL — Internal Use Only  
**Regulatory Basis:** FDA Guidance — "Cybersecurity in Medical Devices: Quality System Considerations and Content of Premarket Submissions" (2023)

---

## 1. Purpose

This plan establishes procedures for ongoing cybersecurity monitoring, vulnerability management, and incident response for the Technical Made Easy (TME) platform after product release. It satisfies FDA post-market cybersecurity requirements for connected medical device software (SaMD/cyber devices).

---

## 2. Scope

| Component | Description |
|---|---|
| **Frontend** | React PWA (technical-made-easy) — client browsers |
| **Backend API** | Express.js/Node.js (tech-made-easy-backend) — cloud-hosted |
| **Database** | MongoDB Atlas — managed cloud |
| **Mobile** | React Native app (tech-made-easy-mobile) |
| **Integrations** | QuickBooks, Stripe, Resend, Google Calendar, Salesforce, SAP |

---

## 3. Vulnerability Monitoring

### 3.1 Dependency Monitoring

| Activity | Tool | Frequency | Owner |
|---|---|---|---|
| Dependency vulnerability scan | `npm audit` | Every build (CI/CD) | DevOps |
| SBOM regeneration | `npm run sbom` / `node scripts/generateSBOM.cjs` | Every release | Dev Lead |
| CVE feed monitoring | GitHub Dependabot / Snyk | Continuous (automated) | DevOps |
| Third-party integration audit | Manual review of integration API changelogs | Monthly | Dev Lead |

### 3.2 Platform Monitoring

| Activity | Tool | Frequency | Owner |
|---|---|---|---|
| Application error monitoring | Console + error handler middleware | Continuous | DevOps |
| API rate limit / abuse detection | Rate limiter logs + analytics | Daily review | Security Lead |
| Audit log integrity verification | `verifyAuditIntegrity()` | Weekly | Compliance Officer |
| Security header validation | Automated header check (OWASP ZAP) | Monthly | Security Lead |

### 3.3 Threat Intelligence

| Source | What We Monitor | Action Trigger |
|---|---|---|
| NVD (National Vulnerability Database) | CVEs affecting Node.js, Express, MongoDB, React | Score ≥ 7.0 |
| CISA KEV (Known Exploited Vulnerabilities) | Active exploitation reports | Any match to our stack |
| npm Security Advisories | Package-level vulnerabilities | Any severity |
| MongoDB Atlas Alerts | Database security events | Any anomaly |

---

## 4. Patch Management

### 4.1 Severity-Based Response Times

| Severity | CVSS Score | Patch Deadline | Deployment Deadline |
|---|---|---|---|
| 🔴 **Critical** | 9.0 – 10.0 | 24 hours | 48 hours |
| 🔴 **High** | 7.0 – 8.9 | 72 hours | 7 days |
| 🟡 **Medium** | 4.0 – 6.9 | 14 days | 30 days |
| 🟢 **Low** | 0.1 – 3.9 | Next release cycle | Next release cycle |

### 4.2 Patch Workflow

```
1. CVE Detected (automated alert)
   │
2. Triage (Security Lead — within 4 hours)
   │  ├── Does it affect our stack? (check SBOM)
   │  ├── Is it exploitable in our configuration?
   │  └── Assign severity rating
   │
3. Develop Patch (Dev Team)
   │  ├── Update dependency / apply fix
   │  ├── Run test suite (automated)
   │  └── Regenerate SBOM
   │
4. Verify (QA + Security Lead)
   │  ├── Regression tests pass
   │  ├── Pen test if severity ≥ High
   │  └── Audit log entry created
   │
5. Deploy (DevOps)
   │  ├── Stage → Production rollout
   │  ├── Monitor for 24 hours
   │  └── Customer notification (if applicable)
   │
6. Document (Compliance Officer)
      ├── Update THREAT_MODEL.md
      ├── Update SBOM
      └── File incident report (if breach)
```

### 4.3 Emergency Patching

For **actively exploited** vulnerabilities (CISA KEV):
- Immediate war-room convened (Security Lead + Dev Lead)
- Hotfix branch created, tested, deployed within **24 hours**
- Customer notification within **48 hours**
- FDA notification within **72 hours** (if patient safety impact)

---

## 5. Incident Response Plan

### 5.1 Incident Classification

| Level | Description | Example |
|---|---|---|
| **P1 — Critical** | Active breach, PHI exposure confirmed | Database compromise, stolen credentials |
| **P2 — High** | Vulnerability exploited, no confirmed PHI exposure | XSS attack blocked by sanitizer |
| **P3 — Medium** | Vulnerability discovered, not exploited | Dependency CVE, misconfiguration |
| **P4 — Low** | Security improvement opportunity | Minor header missing |

### 5.2 Response Procedures

#### P1 — Critical Incident Response (< 1 hour)

1. **Contain** — Isolate affected systems (rotate API keys, revoke tokens)
2. **Assess** — Determine scope of PHI exposure
3. **Notify** — Internal escalation to Security Lead + CEO within 1 hour
4. **Preserve** — Capture audit logs, system state, network logs
5. **Remediate** — Deploy fix, rotate all credentials
6. **Report** — File breach notification per HIPAA Breach Notification Rule:
   - **Individuals affected:** Within 60 days
   - **HHS/OCR:** Within 60 days (if ≥ 500 individuals, also notify media)
   - **FDA:** Within 72 hours (if device safety impact)

#### P2–P4 — Standard Response

1. Log incident in audit system
2. Triage within severity-based timeline
3. Develop and test fix
4. Deploy and monitor
5. Update compliance documentation

### 5.3 Incident Response Team

| Role | Responsibility | Escalation Contact |
|---|---|---|
| **Security Lead** | Triage, technical response, forensics | Primary on-call |
| **Dev Lead** | Patch development, code review | Secondary |
| **Compliance Officer** | Regulatory notifications, documentation | Within 4 hours |
| **CEO** | Business decisions, media, legal | P1 only — immediate |

---

## 6. Customer Notification Procedures

### 6.1 When to Notify

| Scenario | Notification Required | Timeline |
|---|---|---|
| Confirmed PHI breach | ✅ Yes (HIPAA mandate) | Within 60 days |
| Vulnerability patched (no breach) | 🟡 Advisory recommended | Next release notes |
| Planned security maintenance | ✅ Yes | 48 hours advance notice |
| New security feature added | 🟡 Optional | Release notes |

### 6.2 Notification Channels

| Channel | Use Case | Owner |
|---|---|---|
| **In-app notification** | Security advisories, maintenance windows | Dev Team |
| **Email (Resend)** | Breach notifications, critical patches | Compliance Officer |
| **Status page** | Planned maintenance, outages | DevOps |
| **Phone** | P1 incidents to affected healthcare providers | CEO / Compliance |

### 6.3 Notification Template

```
SECURITY ADVISORY — Technical Made Easy
Date: [DATE]
Severity: [CRITICAL / HIGH / MEDIUM / LOW]
Affected Component: [Component Name]
   
Summary: [Brief description of the issue]
Impact: [What data or functionality was/could be affected]
Action Taken: [Patch deployed, credentials rotated, etc.]
Action Required by Customer: [Update app, change password, etc.]
   
For questions: security@technical-made-easy.com
Reference: [CVE ID or Internal Incident ID]
```

---

## 7. Software Update Integrity

### 7.1 Build Verification

| Control | Implementation |
|---|---|
| Source control | Git with commit signing (GPG) |
| CI/CD pipeline | GitHub Actions with environment secrets |
| Build artifacts | Vite production build with content hashing |
| Service worker | PWA update detection via `vite-plugin-pwa` |
| Dependency lock | `package-lock.json` committed, `npm ci` in CI |

### 7.2 Update Distribution

| Component | Update Mechanism | Integrity Check |
|---|---|---|
| Frontend PWA | Service worker auto-update | Content-hash filenames + CSP |
| Backend API | Git-based deployment (Render/Vercel) | Commit SHA verification |
| Mobile app | App store distribution | Store-level code signing |
| Database | MongoDB Atlas managed | Automated backups + encryption |

---

## 8. Metrics & Reporting

### 8.1 Key Security Metrics

| Metric | Target | Measurement |
|---|---|---|
| Mean Time to Detect (MTTD) | < 24 hours | Time from CVE publish to team awareness |
| Mean Time to Patch (MTTP) | < 72 hours (Critical) | Time from detection to production deploy |
| Dependency vulnerability count | 0 Critical, 0 High | `npm audit` output |
| Audit log integrity | 100% chain valid | `verifyAuditIntegrity()` weekly check |
| Incident response coverage | 100% incidents documented | Audit log review |

### 8.2 Quarterly Security Review

Every quarter, the Security Lead produces a report covering:
1. Vulnerabilities detected and remediated
2. Patch compliance (% within SLA)
3. Incident summary
4. SBOM changes since last quarter
5. Recommendations for the next quarter

---

## 9. Regulatory Compliance Matrix

| Requirement | Regulation | Status |
|---|---|---|
| Vulnerability monitoring | FDA SPDF §6.2 | ✅ |
| Patch management with timelines | FDA SPDF §6.3 | ✅ |
| Incident response procedures | HIPAA §164.308(a)(6) | ✅ |
| Breach notification | HIPAA §164.404-408 | ✅ |
| Software Bill of Materials | FDA SPDF §5.4 | ✅ |
| Threat model maintenance | FDA SPDF §5.1 | ✅ |
| Post-market surveillance | FDA §803 / MDR | ✅ |

---

**Document Status:** ✅ Complete  
**Approved By:** ______________________  
**Date:** ______________________  
**Next Review Date:** June 12, 2026
