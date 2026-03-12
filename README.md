# ⚕️ Technical Made Easy — Backend API

> **Express.js + MongoDB REST API** powering the Technical Made Easy work order management platform. HIPAA-compliant, multi-tenant, production-ready.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

---

## 🎯 Overview

This is the backend API for [Technical Made Easy](https://github.com/tappout360/technical-made-easy), a HIPAA-compliant work order management SaaS platform. It provides RESTful endpoints for authentication, company management, work orders, inventory, billing, and more.

**Live API**: Hosted on [Render](https://render.com)

---

## 🏗️ Architecture

```mermaid
graph LR
    subgraph Frontend
        REACT["React App (Vercel)"]
    end

    subgraph API["Express 5 API (Render)"]
        MW["Middleware Stack"]
        ROUTES["22 Route Modules"]
        SVC["Service Layer"]
    end

    subgraph Middleware
        AUTH["JWT Auth"]
        RL["Rate Limiter"]
        HIPAA["HIPAA Suite<br/>sanitizeInput | sanitizeResponse<br/>logPHIAccess | enforceHTTPS<br/>securityHeaders"]
    end

    subgraph Data
        MONGO["MongoDB Atlas<br/>AES-256 Encrypted"]
    end

    subgraph External
        RESEND["Resend (Email)"]
        STRIPE["Stripe (Payments)"]
    end

    REACT -->|HTTPS| MW
    MW --> AUTH
    MW --> RL
    MW --> HIPAA
    AUTH --> ROUTES
    ROUTES --> SVC
    ROUTES --> MONGO
    SVC --> RESEND
    SVC --> STRIPE
```

---

## ✨ Features

- 🔐 **JWT Authentication** — Short-lived tokens with bcrypt password hashing (10 salt rounds)
- 🔑 **MFA** — Email-based OTP via Resend (6-digit, 5-minute expiry)
- 🏥 **Multi-tenant** — Company-scoped data isolation on all queries
- 🏭 **Multi-industry** — Industry field on companies (service, hospital, plumbing, electrical, automotive, construction)
- 📧 **Transactional Email** — Resend integration for notifications, MFA, and approvals
- 💰 **Stripe Integration** — Payment processing and subscription management
- 🛡️ **Rate Limiting** — Auth: 20/15min, API: 200/15min
- 📦 **Compression** — gzip response compression (~60-80% size reduction)
- 🧹 **Input Sanitization** — NoSQL injection prevention + XSS tag stripping (Mongoose sanitization)
- 📋 **Response Sanitization** — Automatic removal of passwords/secrets from all JSON responses
- 🔗 **Audit Hash Chain** — Tamper-evident audit log with cryptographic hash chain (§164.312(c)(1))
- 🧪 **Testing** — Jest + Supertest for API testing
- 📊 **Health Checks** — Built-in health check endpoint and script
- 🗄️ **Response Caching** — 30s cache on GET endpoints (auth/audit excluded)

---

## 🔒 Security Deep Dive

### Authentication & Sessions
- **bcryptjs** — 10 salt rounds for password hashing
- **JWT tokens** — Short expiry, stored in sessionStorage (not localStorage)
- **MFA** — 6-digit email OTP with 5-minute TTL, max 3 attempts before lockout
- **Rate limiting** — Auth endpoints: 20 attempts/15min window; API: 200 req/15min
- **Session timeout** — Frontend enforces 15-min HIPAA auto-logout

### HIPAA Middleware Stack (applied in order)
1. `enforceHTTPS` — Redirects HTTP → HTTPS in production (§164.312(e)(1))
2. `securityHeaders` — X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security
3. `sanitizeInput` — Strips `$` operators from request bodies (NoSQL injection prevention)
4. `sanitizeResponse` — Removes `password`, `__v`, sensitive fields from all JSON responses
5. `logPHIAccess` — Logs all API access with userId, path, method, IP, timestamp
6. `initHashChain` — Initializes cryptographic hash chain for tamper-evident audit trail

### Audit Logging
- **Dedicated audit route** (`/api/v1/audit`) for compliance review
- Every audit entry includes: `userId`, `action`, `resource`, `timestamp`, `ipAddress`, `metadata`
- **Hash chain** — Each entry's hash includes the previous entry's hash, creating a tamper-evident chain (§164.312(c)(1))
- Auth excluded from response cache (`no-store`)

### Data Encryption
- **At rest** — MongoDB Atlas with AES-256 encryption, SOC 2 Type II certified
- **In transit** — TLS 1.3 on all connections (Render enforced)

---

## 🔌 Real-Time Updates

> **Current**: Polling-based updates via REST API with 30s caching  
> **Planned**: Socket.io integration for live dispatch board updates, real-time WO status changes, and instant messaging. Redis adapter planned for horizontal scaling.

---

## 📡 API Endpoints

### Quick Start: Postman Collection
Import [`postman_collection.json`](postman_collection.json) into Postman for ready-to-use requests with sample bodies.

### Core Routes (22 modules)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Server health check |
| **Auth** | | |
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login → JWT + MFA |
| GET | `/api/v1/auth/me` | Current user profile |
| **Companies** | | |
| GET | `/api/v1/companies` | List companies |
| POST | `/api/v1/companies` | Create company |
| PUT | `/api/v1/companies/:id` | Update company |
| POST | `/api/v1/companies/apply` | Submit application |
| **Work Orders** | | |
| GET | `/api/v1/work-orders` | List WOs (company-scoped) |
| POST | `/api/v1/work-orders` | Create WO |
| PUT | `/api/v1/work-orders/:id` | Update WO |
| **Clients** | | |
| GET | `/api/v1/clients` | List clients |
| POST | `/api/v1/clients` | Create client |
| **Assets** | | |
| GET | `/api/v1/assets` | List equipment assets |
| POST | `/api/v1/assets` | Add asset |
| **Inventory** | | |
| GET | `/api/v1/inventory` | List parts/inventory |
| POST | `/api/v1/inventory` | Add inventory item |
| **Audit** | | |
| GET | `/api/v1/audit` | Audit log (HIPAA) |
| **Integrations** | | |
| * | `/api/v1/stripe/*` | Stripe payments |
| * | `/api/v1/quickbooks/*` | QuickBooks sync |
| * | `/api/v1/sensors/*` | IoT sensor data |
| * | `/api/v1/billing/*` | Billing management |
| * | `/api/v1/platform/*` | Platform admin |

---

## 📁 Project Structure

```
├── server.js           # Entry point — Express app, middleware, routes
├── middleware/
│   ├── auth.js         # JWT verification middleware
│   └── hipaaCompliance.js  # HIPAA security suite (6 middleware functions)
├── models/
│   ├── User.js         # User schema (roles, company, auth)
│   ├── Company.js      # Company schema (settings, industry, branding)
│   ├── WorkOrder.js    # Work order schema (full lifecycle)
│   ├── Client.js       # Client schema (portal settings)
│   ├── Inventory.js    # Inventory/parts schema
│   ├── Notification.js # Notification schema
│   └── SensorReading.js # IoT sensor data schema
├── routes/             # 22 route modules (see API Endpoints)
├── services/
│   └── emailService.js # Resend email service
├── scripts/
│   ├── seed.js         # Database seeding
│   └── healthCheck.js  # Health check utility
├── __tests__/          # Jest test suites
└── postman_collection.json  # Postman API collection
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- npm 9+

### Install & Run
```bash
git clone https://github.com/tappout360/tech-made-easy-backend.git
cd tech-made-easy-backend
npm install
cp .env.example .env    # Configure your environment
npm run dev             # Starts with --watch for auto-reload
```

The API runs at `http://localhost:5000`.

### Environment Variables
Copy `.env.example` and configure:
```env
PORT=5000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET=your-secret-key
CORS_ORIGINS=http://localhost:5173
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Technical Made Easy <noreply@send.technical-made-easy.com>
STRIPE_SECRET_KEY=sk_xxxxxxxxxxxx
```

### Available Scripts
```bash
npm start       # Production server
npm run dev     # Dev server with auto-reload
npm run seed    # Seed database with sample data
npm run health  # Run health check
npm test        # Run test suite
```

---

## 🗺️ Roadmap

| Phase | Features | Status |
|-------|----------|--------|
| **Alpha** | REST API, JWT auth, HIPAA middleware, multi-tenant | ✅ Complete |
| **Beta** | Socket.io real-time, Docker Compose, Artillery load tests | 🔄 Planned |
| **v1.0** | Redis adapter, BullMQ job queue, Sentry monitoring | 📋 Planned |

---

## 🔗 Related

| Repo | Description |
|------|-------------|
| [technical-made-easy](https://github.com/tappout360/technical-made-easy) | React frontend (Vite + PWA) |

---

## 📄 License

ISC © Technical Made Easy
