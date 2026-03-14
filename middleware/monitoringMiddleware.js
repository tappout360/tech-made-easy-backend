// ═══════════════════════════════════════════════════════════════
//  MONITORING MIDDLEWARE — Structured Logging & Alert Triggers
//  Technical Made Easy — Beta Readiness
//
//  Features:
//  1. 5xx response logger → Sentry + structured console output
//  2. Response time tracking for performance monitoring
//  3. Rate-limit spike handler (429 → Sentry alert)
//
//  HIPAA: No PHI in logs — only status codes, routes, timing.
// ═══════════════════════════════════════════════════════════════
const { captureError, Sentry } = require('../services/sentryInit');

// ── 5xx Response Logger ──────────────────────────────────────
// Fires after every response; logs 5xx errors with structure
function responseLogger(req, res, next) {
  const start = Date.now();

  // Hook into response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // Log all 5xx errors
    if (status >= 500) {
      const logEntry = {
        level: 'error',
        type: '5XX_RESPONSE',
        status,
        method: req.method,
        path: req.originalUrl,
        duration: `${duration}ms`,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      };
      console.error('[MONITOR] 5xx Error:', JSON.stringify(logEntry));

      // Fire to Sentry
      captureError(new Error(`5xx: ${req.method} ${req.originalUrl} → ${status}`), {
        route: req.originalUrl,
        extra: { status, duration, method: req.method },
      });
    }

    // Log slow responses (> 5s) as warnings
    if (duration > 5000 && status < 500) {
      console.warn(`[MONITOR] Slow response: ${req.method} ${req.originalUrl} → ${duration}ms`);
    }
  });

  next();
}

// ── Rate Limit Spike Handler ─────────────────────────────────
// Custom handler for express-rate-limit — fires Sentry alert on 429
function rateLimitAlertHandler(req, res, next, options) {
  const logEntry = {
    level: 'warn',
    type: 'RATE_LIMIT_HIT',
    path: req.originalUrl,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  };
  console.warn('[MONITOR] Rate limit triggered:', JSON.stringify(logEntry));

  // Fire to Sentry as a warning
  if (Sentry) {
    Sentry.withScope((scope) => {
      scope.setLevel('warning');
      scope.setTag('type', 'rate_limit');
      scope.setTag('path', req.originalUrl);
      Sentry.captureMessage(`Rate limit hit: ${req.originalUrl} from ${req.ip}`);
    });
  }

  // Send standard 429 response
  res.status(429).json(options.message);
}

// ── Mongoose Connection Monitor ──────────────────────────────
// Call once during startup to attach event listeners
function initMongooseMonitoring(mongoose) {
  const conn = mongoose.connection;

  conn.on('error', (err) => {
    console.error('[MONITOR] MongoDB error:', err.message);
    captureError(err, {
      route: 'mongoose',
      extra: { event: 'error', message: err.message },
    });
  });

  conn.on('disconnected', () => {
    console.warn('[MONITOR] MongoDB disconnected — attempting reconnect...');
    if (Sentry) {
      Sentry.withScope((scope) => {
        scope.setLevel('error');
        scope.setTag('type', 'mongo_disconnect');
        Sentry.captureMessage('MongoDB disconnected unexpectedly');
      });
    }
  });

  conn.on('reconnected', () => {
    console.log('[MONITOR] ✅ MongoDB reconnected');
    if (Sentry) {
      Sentry.withScope((scope) => {
        scope.setLevel('info');
        Sentry.captureMessage('MongoDB reconnected successfully');
      });
    }
  });

  console.log('[MONITOR] ✅ Mongoose connection monitoring active');
}

module.exports = {
  responseLogger,
  rateLimitAlertHandler,
  initMongooseMonitoring,
};
