require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Support large inventory imports

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

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ msg: 'Internal server error' });
});

// ── Connect to MongoDB ──
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/v1/health`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  });
