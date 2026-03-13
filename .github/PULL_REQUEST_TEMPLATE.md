## What does this PR do?
<!-- Brief description -->

## Type of Change
- [ ] 🐛 Bug fix
- [ ] ✨ New feature / endpoint
- [ ] ♻️ Refactor
- [ ] 🔒 Security fix
- [ ] 📄 Documentation

## API Changes
<!-- List any new or changed endpoints -->

## Database Changes
<!-- New models, schema changes, migrations -->

---

## ✅ PR Checklist

### Code Quality
- [ ] All queries are company-scoped (`companyId: req.user.companyId`)
- [ ] `auth` middleware applied to all non-public routes
- [ ] Error responses use consistent format `{ error: 'message' }`
- [ ] No hardcoded secrets or credentials

### HIPAA Compliance
- [ ] PHI access auto-logged via `logPHIAccess` middleware
- [ ] Sensitive operations create AuditLog entries
- [ ] `sanitizeResponse` covers any new sensitive fields
- [ ] Input validation via Mongoose schema

### Testing
- [ ] Tested with Postman or curl
- [ ] Health check still passes (`/api/v1/health`)
- [ ] No new deprecation warnings in console
