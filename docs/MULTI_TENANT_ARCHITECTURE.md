# Multi-Tenant Architecture — Data Isolation & Shared Entities

**Status:** 🟢 Active  
**Version:** 1.0  
**Compliance:** HIPAA multi-tenant data isolation

---

## Problem Statement

When multiple companies AND their client facilities use the same platform, data isolation is critical:

**Example Scenario:**
- **MassMedical** (specialty service company) → works for Children's Hospital
- **Medical Solutions** (biomed company) → works for the same Children's Hospital  
- **Children's Hospital** (client facility) → has their own account

All three are on the platform. The system must:
1. Keep each company's data completely isolated
2. Handle the shared entity (Children's Hospital) without duplication conflicts
3. Route WOs, billing, and equipment records to the correct company
4. Prevent cross-company data leakage

---

## Architecture: Company-Scoped Multi-Tenancy

### Core Principle: Every Document Has a `companyId`

```
┌─────────────────────────────────────────────────────────────┐
│                    TME Platform (Single DB)                  │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │ MassMedical │  │  Med Sol.   │  │ Children's Hosp  │    │
│  │ companyId:  │  │ companyId:  │  │ companyId:        │    │
│  │   "MM-001"  │  │  "MS-002"   │  │   "CH-003"       │    │
│  ├─────────────┤  ├─────────────┤  ├──────────────────┤    │
│  │ WOs: MM-*   │  │ WOs: MS-*   │  │ WOs: CH-*        │    │
│  │ Techs: 5    │  │ Techs: 12   │  │ Internal staff   │    │
│  │ Clients:    │  │ Clients:    │  │ Vendors:          │    │
│  │  - CH (spec)│  │  - CH (bio) │  │  - MM, MS        │    │
│  │  - Other    │  │  - Other    │  │  - Other          │    │
│  └─────────────┘  └─────────────┘  └──────────────────┘    │
│                                                             │
│  Data isolation enforced at:                                │
│  1. API middleware (companyId filter on every query)         │
│  2. Socket.io rooms (company:{companyId})                   │
│  3. Client-side context (company-scoped state)              │
│  4. Audit logging (per-company hash chains)                 │
└─────────────────────────────────────────────────────────────┘
```

### Shared Client Entity Pattern

Children's Hospital exists as a **separate client record** in EACH company's scope:

```
MassMedical's client list:
  { name: "Children's Hospital", companyId: "MM-001", 
    serviceType: "specialty", accountRef: "CH-SPEC-001" }

Medical Solutions' client list:
  { name: "Children's Hospital", companyId: "MS-002",  
    serviceType: "biomed", accountRef: "CH-BIO-002" }

Children's Hospital's own account:
  { name: "Children's Hospital", companyId: "CH-003",
    type: "CLIENT_FACILITY" }
```

**Key point:** The same hospital IS duplicated — intentionally. Each company sees their own version with their own WOs, billing, equipment records, and notes. There is NO cross-company data sharing.

### Why Duplicate Instead of Share?

| Shared Entity (Bad) | Duplicated Entity (Good) |
|---|---|
| One company could see another's WOs | Complete isolation |
| Billing conflicts | Each company bills independently |
| Equipment records mixed | Each company tracks their own scope |
| HIPAA violation risk | Each company is their own tenant |
| Update one → affects all | Updates are company-scoped |

---

## Data Isolation Enforcement Points

### 1. API Middleware (server-side)

```javascript
// Every API route automatically filters by companyId
app.use('/api/v1/workorders', (req, res, next) => {
  req.query.companyId = req.user.companyId; // Force company scope
  next();
});
```

### 2. Socket.io Rooms (real-time)

```javascript
// Each company gets isolated rooms
socket.join(`company:${companyId}`);    // Company-wide events
socket.join(`staff:${companyId}`);      // Staff-only (no clients)
socket.join(`client:${companyId}:${userId}`); // Client sub-room
```

### 3. MongoDB Query Scoping

```javascript
// All queries automatically include companyId filter
const workOrders = await WorkOrder.find({ 
  companyId: req.user.companyId,  // Always scoped
  status: 'Open' 
});
```

### 4. Client-Side Context

```javascript
// React context provides company-scoped data
const { company, workOrders } = useCompanyContext();
// workOrders are already filtered to current company
```

---

## Butler AI — Client vs Staff Information Control

### The Rule
> **Clients get OPERATIONAL information only.**  
> They can see WO status, schedule, and billing.  
> They CANNOT get technical support, troubleshooting, or equipment repair information.  
> That knowledge is the company's value proposition.

### How It's Enforced

```javascript
// butlerEngine.js — Client role check
if (user.role === 'CLIENT') {
  // LIMITED knowledge base:
  // ✅ WO status, schedule, billing
  // ✅ Submit new WO/PM request
  // ✅ View their equipment list
  // ❌ NO troubleshooting guides
  // ❌ NO repair procedures  
  // ❌ NO parts information
  // ❌ NO training mode
  // ❌ NO equipment manuals
}
```

### Client Workflow (Sterilizer Reset Example)

```
Client asks Butler: "How do I reset my sterilizer?"
 ↓
Butler (CLIENT mode): "I can help you submit a work order for 
sterilizer service. A qualified technician will contact you to 
assist. Would you like me to create a WO now?"
 ↓
Client submits WO → Tech receives assignment → Tech calls client
 ↓
Tech decides whether to walk client through reset (or send on-site)
```

The company retains control of their technical knowledge.

---

## Redis Roadmap (Production Scaling)

### Phase 1: Session Store (v1.1)
```
[ ] Replace in-memory sessions with Redis
[ ] Add session persistence across server restarts
[ ] Configure TTL matching HIPAA auto-logoff (15 min)
```

### Phase 2: Socket.io Adapter (v1.2)
```
[ ] Install @socket.io/redis-adapter
[ ] Enable horizontal scaling (2+ API instances)
[ ] Company rooms work across instances
```

### Phase 3: Caching Layer (v1.3)
```
[ ] Cache equipment knowledge base (60-second TTL)
[ ] Cache company settings (5-minute TTL)
[ ] Cache SBOM data (24-hour TTL)
[ ] Add cache invalidation on writes
```

---

## Monitoring Integration

### Uptime Kuma (Self-Hosted)

Included in `docker-compose.yml`. Monitors:
- API health endpoint (`/api/v1/health`)
- MongoDB connection status
- Redis connection status
- SSL certificate expiry
- Response time alerting (> 500ms)

### Alert Channels
```yaml
# Uptime Kuma supports:
- Slack webhook
- Email (via Resend)
- SMS (via Twilio)
- Discord webhook
```

### Application-Level Monitoring

| Metric | Source | Alert Threshold |
|---|---|---|
| API response time | Health endpoint | > 500ms p95 |
| Error rate | Audit log | > 1% per hour |
| Failed logins | Auth middleware | > 10 per 15min |
| Memory usage | Process metrics | > 80% of container limit |
| DB connection pool | Mongoose | < 2 available connections |
| AI security violations | aiSecurityFilter | > 5 per session |
