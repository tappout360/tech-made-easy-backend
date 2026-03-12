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
