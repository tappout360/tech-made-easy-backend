# Contributing to Technical Made Easy (Backend API)

Thank you for contributing! This guide will get you productive on the Express/MongoDB backend.

---

## 🚀 Quick Start (5 Minutes)

```bash
git clone https://github.com/tappout360/tech-made-easy-backend.git
cd tech-made-easy-backend
npm install
cp .env.example .env    # Fill in MONGO_URI + JWT_SECRET minimum
npm run dev             # → http://localhost:5000
```

Verify it works: `curl http://localhost:5000/api/v1/health`

---

## 🏗️ Architecture at a Glance

```
Express 5 API (Node.js 22)
├── server.js              ← Entry point (middleware + route mounting)
├── middleware/             ← JWT auth + HIPAA compliance suite
├── models/     (13)       ← Mongoose schemas
├── routes/     (28)       ← REST API modules
├── services/              ← Email (Resend) + Socket.io
└── docker-compose.yml     ← MongoDB + Redis + API + Uptime Kuma
```

### Request Pipeline

Every request flows through this middleware stack (in order):

```
Request → CORS → Rate Limiter → Compression → JSON Parser
        → enforceHTTPS → securityHeaders → sanitizeInput
        → sanitizeResponse → logPHIAccess → JWT Auth (protected routes)
        → Route Handler → Response
```

### Route Modules (routes/)

| File | Base Path | Purpose |
|------|-----------|---------|
| `auth.js` | `/api/v1/auth` | Register, login, MFA, password reset |
| `companies.js` | `/api/v1/companies` | Company CRUD, applications |
| `workOrders.js` | `/api/v1/work-orders` | WO lifecycle (create → complete) |
| `clients.js` | `/api/v1/clients` | Client management |
| `assets.js` | `/api/v1/assets` | Equipment/asset tracking |
| `inventory.js` | `/api/v1/inventory` | Parts and inventory |
| `billing.js` | `/api/v1/billing` | Invoicing, payment tracking |
| `purchaseOrders.js` | `/api/v1/purchase-orders` | PO workflow |
| `vendors.js` | `/api/v1/vendors` | Vendor management |
| `audit.js` | `/api/v1/audit` | HIPAA audit log |
| `analytics.js` | `/api/v1/analytics` | Reporting data |
| `calendar.js` | `/api/v1/calendar` | Schedule events |
| `notifications.js` | `/api/v1/notifications` | Push/in-app notifications |
| `sensors.js` | `/api/v1/sensors` | IoT sensor readings |
| `users.js` | `/api/v1/users` | User management |
| `platform.js` | `/api/v1/platform` | Platform admin operations |
| `sync.js` | `/api/v1/sync` | Data sync between services |
| `import.js` | `/api/v1/import` | CSV/bulk import |
| `webhooks.js` | `/api/v1/webhooks` | Webhook management |
| **Integrations** | | |
| `stripe.js` | `/api/v1/stripe` | Stripe payments |
| `quickbooks.js` | `/api/v1/quickbooks` | QuickBooks accounting |
| `salesforce.js` | `/api/v1/salesforce` | Salesforce CRM |
| `servicenow.js` | `/api/v1/servicenow` | ServiceNow ITSM |
| `sap.js` | `/api/v1/sap` | SAP ERP |
| `epic.js` | `/api/v1/epic` | Epic EHR (FHIR) |
| `docusign.js` | `/api/v1/docusign` | DocuSign e-signatures |
| `paylocity.js` | `/api/v1/paylocity` | Paylocity payroll |
| `maps.js` | `/api/v1/maps` | Google Maps routing |

### Database Models (models/)

| Model | Collection | Key Fields |
|-------|-----------|------------|
| `User.js` | users | name, email, password, role, companyId |
| `Company.js` | companies | name, industry, companySettings, subscription |
| `WorkOrder.js` | workorders | woNumber, status, assignedTechId, companyId |
| `Client.js` | clients | name, accountNumber, companyId, portalSettings |
| `Asset.js` | assets | name, serialNumber, companyId, pmSchedule |
| `Inventory.js` | inventory | partNumber, quantity, minStock, companyId |
| `PurchaseOrder.js` | purchaseorders | poNumber, status, vendorId, lineItems |
| `Vendor.js` | vendors | name, contact, companyId |
| `AuditLog.js` | auditlogs | userId, action, resource, ipAddress, hash |
| `Notification.js` | notifications | userId, title, body, read |
| `SensorReading.js` | sensorreadings | assetId, readings, timestamp |
| `Webhook.js` | webhooks | url, events, companyId, secret |
| `MfaCode.js` | mfacodes | userId, code, expiresAt, attempts |

---

## 📏 Code Style

### Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Route files | camelCase | `workOrders.js`, `purchaseOrders.js` |
| Model files | PascalCase | `WorkOrder.js`, `AuditLog.js` |
| Middleware | camelCase | `auth.js`, `hipaaCompliance.js` |
| Route paths | kebab-case | `/api/v1/work-orders`, `/api/v1/purchase-orders` |
| DB fields | camelCase | `companyId`, `assignedTechId`, `woNumber` |

### Route Handler Pattern

```javascript
// routes/myFeature.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const MyModel = require('../models/MyModel');

// GET /api/v1/my-feature — List all (company-scoped)
router.get('/', auth, async (req, res) => {
  try {
    const items = await MyModel.find({ companyId: req.user.companyId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch (err) {
    console.error('MyFeature GET error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/v1/my-feature — Create new
router.post('/', auth, async (req, res) => {
  try {
    const item = new MyModel({
      ...req.body,
      companyId: req.user.companyId,
      createdBy: req.user.id,
    });
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    console.error('MyFeature POST error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

### Mounting a New Route

In `server.js`:
```javascript
app.use('/api/v1/my-feature', require('./routes/myFeature'));
```

---

## 🌿 Branch Strategy

Same as frontend:
```
main                    ← Production (auto-deploys to Render)
├── feature/add-xyz
├── fix/broken-thing
└── hotfix/critical
```

---

## 📝 Commit Messages

```
feat: add fleet tracker API routes
fix: company-scope filter on work order queries
docs: add CONTRIBUTING.md
security: add rate limiting to sensor endpoints
```

---

## ⚠️ HIPAA Rules for New Code

1. **Always company-scope** — Every query MUST filter by `req.user.companyId`
2. **Use `auth` middleware** — All routes except health checks require JWT
3. **Sanitize inputs** — The HIPAA middleware handles this, but validate with Mongoose schemas
4. **Never return passwords** — `sanitizeResponse` strips `password` and `__v` automatically
5. **Log PHI access** — `logPHIAccess` middleware logs all API calls automatically
6. **Audit trail** — For sensitive operations, write to AuditLog with hash chain

---

## 🐳 Docker

```bash
docker-compose up -d    # MongoDB + Redis + API + Uptime Kuma
```

The `docker-compose.yml` includes:
- **MongoDB** — Local database (port 27017)
- **Redis** — Session store / Socket.io adapter (port 6379)
- **API** — This app (port 5000)
- **Uptime Kuma** — Monitoring dashboard (port 3001)

---

## 📞 Questions?

- Open a GitHub issue
- Check `docs/` folder for architecture docs, threat model, and testing plans
