# ⚕️ Technical Made Easy — Backend API

> **Express.js + MongoDB REST API** powering the Technical Made Easy work order management platform. HIPAA-compliant, multi-tenant, production-ready.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

---

## 🎯 Overview

This is the backend API for [Technical Made Easy](https://github.com/tappout360/technical-made-easy), a HIPAA-compliant work order management SaaS platform. It provides RESTful endpoints for authentication, company management, work orders, inventory, billing, and more.

---

## ✨ Features

- 🔐 **JWT Authentication** — Secure token-based auth with bcrypt password hashing
- 🏥 **Multi-tenant** — Company-scoped data isolation
- 🏭 **Multi-industry** — Industry field on companies (service, hospital, plumbing, electrical, automotive, construction)
- 📧 **Transactional Email** — Resend integration for notifications and approvals
- 💰 **Stripe Integration** — Payment processing and subscription management
- 🛡️ **Rate Limiting** — express-rate-limit to prevent abuse
- 📦 **Compression** — gzip response compression
- 🧪 **Testing** — Jest + Supertest for API testing
- 📊 **Health Checks** — Built-in health check endpoint and script

---

## 🏗️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **Runtime** | Node.js 18+ |
| **Framework** | Express 5 |
| **Database** | MongoDB (Mongoose 9) |
| **Auth** | JWT + bcryptjs |
| **Email** | Resend |
| **Payments** | Stripe |
| **Testing** | Jest + Supertest |
| **Hosting** | Render |

---

## 📁 Project Structure

```
├── server.js           # Entry point — Express app setup, middleware, routes
├── middleware/
│   └── auth.js         # JWT verification middleware
├── models/
│   ├── User.js         # User schema (roles, company, auth)
│   ├── Company.js      # Company schema (settings, industry, branding)
│   ├── WorkOrder.js    # Work order schema (full lifecycle)
│   ├── Client.js       # Client schema (portal settings)
│   ├── Inventory.js    # Inventory/parts schema
│   ├── Notification.js # Notification schema
│   └── SensorReading.js # IoT sensor data schema
├── routes/
│   ├── auth.js         # Login, register, token refresh
│   ├── companies.js    # Company CRUD + applications
│   ├── workOrders.js   # Work order CRUD + lifecycle
│   ├── clients.js      # Client management
│   ├── inventory.js    # Inventory management
│   ├── sensors.js      # IoT sensor endpoints
│   └── quickbooks.js   # QuickBooks integration
├── services/
│   └── emailService.js # Resend email service
├── scripts/
│   ├── seed.js         # Database seeding
│   └── healthCheck.js  # Health check utility
└── __tests__/          # Jest test suites
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
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET=your-secret-key
CORS_ORIGINS=http://localhost:5173,https://your-domain.vercel.app
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Your App <noreply@yourdomain.com>
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

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |

### Companies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies` | List companies |
| POST | `/api/companies` | Create company |
| PUT | `/api/companies/:id` | Update company |
| POST | `/api/companies/apply` | Submit company application |

### Work Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workorders` | List work orders (company-scoped) |
| POST | `/api/workorders` | Create work order |
| PUT | `/api/workorders/:id` | Update work order |
| PUT | `/api/workorders/:id/assign` | Assign tech |
| PUT | `/api/workorders/:id/complete` | Mark complete |

### Clients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | List clients |
| POST | `/api/clients` | Create client |
| PUT | `/api/clients/:id` | Update client |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | List inventory items |
| POST | `/api/inventory` | Add inventory item |
| PUT | `/api/inventory/:id` | Update item |

---

## 🔒 Security

- **HIPAA Compliant** — Encrypted data at rest (MongoDB Atlas), encrypted in transit (TLS)
- **JWT Auth** — Short-lived tokens with secure httpOnly cookie option
- **Rate Limiting** — Configurable per-endpoint rate limits
- **Input Validation** — Mongoose schema validation on all models
- **CORS** — Strict origin whitelist
- **Helmet-ready** — Production security headers

---

## 🔗 Related

| Repo | Description |
|------|-------------|
| [technical-made-easy](https://github.com/tappout360/technical-made-easy) | React frontend (Vite + PWA) |

---

## 📄 License

ISC © Technical Made Easy
