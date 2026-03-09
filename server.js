require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const {
  securityHeaders, enforceHTTPS, sanitizeInput, sanitizeResponse,
  logPHIAccess, initHashChain,
} = require('./middleware/hipaaCompliance');

const app = express();
const PORT = process.env.PORT || 5000;
// Trust proxy if we are behind a reverse proxy (like Render/Railway/Heroku/Vercel)
app.set('trust proxy', 1);

// ── Rate Limiting — HIPAA §164.312(a) ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 login/register attempts per window
  message: { msg: 'Too many authentication attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,                  // 200 API requests per window
  message: { msg: 'Rate limit exceeded. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── HIPAA Security Middleware (applied FIRST) ──
app.use(enforceHTTPS);               // §164.312(e)(1) — HTTPS in production
app.use(securityHeaders);            // §164.312(e)(1) — Security headers

// ── Standard Middleware ──
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Support large inventory imports
app.use(sanitizeInput);              // NoSQL injection + XSS tag stripping (after body parse)
app.use(sanitizeResponse);           // §164.312(a) — Strip secrets from all JSON responses
app.use('/api/v1/auth', authLimiter);      // Strict rate limit on auth
app.use('/api/v1', apiLimiter);            // General rate limit on all API
app.use(logPHIAccess);                     // §164.312(b) — PHI access audit logging

// ── Health Check ──
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ── API Routes ──
app.use('/api/v1/auth',          require('./routes/auth'));
app.use('/api/v1/users',         require('./routes/users'));
app.use('/api/v1/work-orders',   require('./routes/workOrders'));
app.use('/api/v1/clients',       require('./routes/clients'));
app.use('/api/v1/assets',        require('./routes/assets'));
app.use('/api/v1/companies',     require('./routes/companies'));
app.use('/api/v1/inventory',     require('./routes/inventory'));
app.use('/api/v1/audit',         require('./routes/audit'));
app.use('/api/v1/notifications', require('./routes/notifications'));
app.use('/api/v1/sensors',       require('./routes/sensors'));
app.use('/api/v1/quickbooks',    require('./routes/quickbooks'));
app.use('/api/v1/maps',          require('./routes/maps'));
app.use('/api/v1/calendar',      require('./routes/calendar'));
app.use('/api/v1/sync',          require('./routes/sync'));
app.use('/api/v1/billing',       require('./routes/billing'));
app.use('/api/v1/salesforce',    require('./routes/salesforce'));
app.use('/api/v1/sap',           require('./routes/sap'));
app.use('/api/v1/servicenow',    require('./routes/servicenow'));
app.use('/api/v1/paylocity',     require('./routes/paylocity'));
app.use('/api/v1/platform',      require('./routes/platform'));  // Platform Owner admin routes

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ msg: 'Internal server error' });
});

// ── Connect to MongoDB ──
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');
    await initHashChain(); // HIPAA §164.312(c)(1) — Resume audit log hash chain
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/v1/health`);
      console.log(`   🔒 HIPAA/FDA compliance middleware active`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  });
