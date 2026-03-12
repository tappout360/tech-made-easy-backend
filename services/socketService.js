/**
 * ═══════════════════════════════════════════════════════════════════
 * SOCKET.IO — Real-Time Events with Per-Company Room Isolation
 * Technical Made Easy — Multi-Tenant Real-Time Engine
 *
 * Architecture:
 *   - Each company gets its own Socket.io room: `company:<companyId>`
 *   - Clients get a sub-room: `client:<companyId>:<clientId>`
 *   - JWT-authenticated connections only
 *   - Events scoped to company boundaries (no cross-tenant leakage)
 *
 * Redis Adapter (Production):
 *   For horizontal scaling across multiple server instances,
 *   add the Redis adapter:
 *     npm install @socket.io/redis-adapter redis
 *     const { createAdapter } = require('@socket.io/redis-adapter');
 *     const { createClient } = require('redis');
 *     const pubClient = createClient({ url: process.env.REDIS_URL });
 *     const subClient = pubClient.duplicate();
 *     io.adapter(createAdapter(pubClient, subClient));
 *
 * ═══════════════════════════════════════════════════════════════════
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Initialize Socket.io with an HTTP server.
 * @param {import('http').Server} httpServer
 * @param {object} opts — Additional Socket.io options
 */
function initSocket(httpServer, opts = {}) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    ...opts,
  });

  // ── JWT Authentication Middleware ──
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;   // { id, email, role, companyId }
      next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection Handler ──
  io.on('connection', (socket) => {
    const { id: userId, companyId, role, email } = socket.user;

    // Auto-join company room (data isolation)
    if (companyId) {
      socket.join(`company:${companyId}`);
      console.log(`[WS] ${email} joined room company:${companyId}`);
    }

    // Client-specific sub-room
    if (role === 'CLIENT') {
      socket.join(`client:${companyId}:${userId}`);
    }

    // Tech-specific room for dispatch
    if (['TECH', 'OFFICE', 'ADMIN', 'COMPANY'].includes(role)) {
      socket.join(`staff:${companyId}`);
    }

    // ── Ping / Pong health check ──
    socket.on('ping', () => socket.emit('pong', { ts: Date.now() }));

    // ── Work Order Events ──
    socket.on('wo:update', (data) => {
      // Broadcast WO update to entire company room
      if (companyId) {
        socket.to(`company:${companyId}`).emit('wo:updated', {
          ...data,
          updatedBy: email,
          ts: Date.now(),
        });
      }
    });

    socket.on('wo:assigned', (data) => {
      // Notify specific tech
      if (data.techId && companyId) {
        io.to(`company:${companyId}`).emit('wo:assignment', {
          woId: data.woId,
          techId: data.techId,
          assignedBy: email,
          ts: Date.now(),
        });
      }
    });

    socket.on('wo:status-change', (data) => {
      if (companyId) {
        io.to(`company:${companyId}`).emit('wo:status', {
          woId: data.woId,
          oldStatus: data.oldStatus,
          newStatus: data.newStatus,
          changedBy: email,
          ts: Date.now(),
        });
      }
    });

    // ── Dispatch Board ──
    socket.on('dispatch:move', (data) => {
      if (companyId) {
        socket.to(`staff:${companyId}`).emit('dispatch:updated', {
          ...data,
          movedBy: email,
          ts: Date.now(),
        });
      }
    });

    // ── Chat / Messaging ──
    socket.on('message:send', (data) => {
      if (companyId && data.recipientId) {
        // Send to specific user within company room
        io.to(`company:${companyId}`).emit('message:new', {
          from: userId,
          fromEmail: email,
          to: data.recipientId,
          text: data.text,
          ts: Date.now(),
        });
      }
    });

    // ── Disconnect ──
    socket.on('disconnect', (reason) => {
      console.log(`[WS] ${email} disconnected (${reason})`);
    });
  });

  console.log('[WS] Socket.io initialized with per-company room isolation');
  return io;
}

/**
 * Get the Socket.io instance.
 * Use this from routes to emit events.
 */
function getIO() {
  if (!io) throw new Error('Socket.io not initialized. Call initSocket(httpServer) first.');
  return io;
}

/**
 * Emit an event to a specific company room.
 * @param {string} companyId
 * @param {string} event
 * @param {object} data
 */
function emitToCompany(companyId, event, data) {
  if (!io) return;
  io.to(`company:${companyId}`).emit(event, { ...data, ts: Date.now() });
}

/**
 * Emit to staff-only room (excludes clients).
 */
function emitToStaff(companyId, event, data) {
  if (!io) return;
  io.to(`staff:${companyId}`).emit(event, { ...data, ts: Date.now() });
}

/**
 * Emit to a specific client sub-room.
 */
function emitToClient(companyId, clientId, event, data) {
  if (!io) return;
  io.to(`client:${companyId}:${clientId}`).emit(event, { ...data, ts: Date.now() });
}

module.exports = {
  initSocket,
  getIO,
  emitToCompany,
  emitToStaff,
  emitToClient,
};
