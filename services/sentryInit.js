// ═══════════════════════════════════════════════════════════════
//  SENTRY ERROR MONITORING — Backend (Node.js / Express)
//  Technical Made Easy — Production Error Tracking
//
//  SETUP:
//  1. Create a free account at https://sentry.io
//  2. Create a project → select "Node.js" or "Express"
//  3. Copy your DSN and set it as SENTRY_DSN in .env
//
//  HIPAA NOTE:
//  Sentry is configured to NOT capture PII (names, emails, IPs).
//  All user identification uses anonymized IDs only.
//  Request bodies are NOT sent — prevents PHI leakage.
// ═══════════════════════════════════════════════════════════════
const Sentry = require('@sentry/node');

const SENTRY_DSN = process.env.SENTRY_DSN;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const APP_VERSION = process.env.APP_VERSION || '2.7.0';

function initSentry(app) {
  if (!SENTRY_DSN) {
    if (IS_PRODUCTION) {
      console.warn('[Sentry] ⚠️ SENTRY_DSN not set — error monitoring disabled');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: IS_PRODUCTION ? 'production' : 'development',
    release: `tme-backend@${APP_VERSION}`,

    // Performance Monitoring
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,

    // ── HIPAA: Strip PII ──
    beforeSend(event) {
      // Remove user PII
      if (event.user) {
        delete event.user.ip_address;
        delete event.user.email;
        delete event.user.username;
      }

      // Remove request body (may contain PHI)
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }

      // Scrub PHI patterns from error messages
      if (event.message) {
        event.message = event.message
          .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL_REDACTED]')
          .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
      }

      return event;
    },

    // Ignore common non-actionable errors
    ignoreErrors: [
      'ECONNRESET',
      'ECONNABORTED',
      'EPIPE',
      'socket hang up',
    ],
  });

  // If Express app is provided, add request handler middleware
  if (app) {
    app.use(Sentry.Handlers.requestHandler({
      // Don't send request bodies (HIPAA)
      request: ['method', 'url', 'query_string'],
      user: ['id'],  // Only anonymized ID
    }));
  }

  console.log(`[Sentry] ✅ Backend initialized (${IS_PRODUCTION ? 'production' : 'dev'} — v${APP_VERSION})`);
}

// Error handler middleware — add AFTER all routes
function sentryErrorHandler() {
  if (!SENTRY_DSN) {
    return (err, req, res, next) => next(err);
  }
  return Sentry.Handlers.errorHandler();
}

// Manual capture helper
function captureError(error, context = {}) {
  if (!SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context.route) scope.setTag('route', context.route);
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.extra) scope.setExtras(context.extra);
    Sentry.captureException(error);
  });
}

module.exports = { initSentry, sentryErrorHandler, captureError, Sentry };
