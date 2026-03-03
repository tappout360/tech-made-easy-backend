// ═══════════════════════════════════════════════════════════════
//  Health Check Script — Pings /api/v1/health and reports status
//
//  Usage:  node scripts/healthCheck.js
//  Exit:   0 = healthy, 1 = unhealthy
//
//  Use with cron, UptimeRobot, or CI pipeline to monitor uptime.
// ═══════════════════════════════════════════════════════════════

const http = require('http');

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 5000;
const PATH = '/api/v1/health';
const TIMEOUT = 5000; // 5 second timeout

const url = `http://${HOST}:${PORT}${PATH}`;

console.log(`[HealthCheck] Pinging ${url}...`);

const req = http.get(url, { timeout: TIMEOUT }, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const isHealthy = res.statusCode === 200 && parsed.status === 'ok';

      console.log(`[HealthCheck] Status: ${res.statusCode}`);
      console.log(`[HealthCheck] Response:`, JSON.stringify(parsed, null, 2));

      if (isHealthy) {
        console.log(`\n✅ HEALTHY — Uptime: ${Math.round(parsed.uptime)}s, MongoDB: ${parsed.mongo}`);
        process.exit(0);
      } else {
        console.log(`\n❌ UNHEALTHY — Status: ${parsed.status}, MongoDB: ${parsed.mongo || 'unknown'}`);
        process.exit(1);
      }
    } catch (e) {
      console.error(`\n❌ UNHEALTHY — Invalid JSON response`);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error(`\n❌ UNREACHABLE — ${err.message}`);
  console.error(`   Is the server running on port ${PORT}?`);
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  console.error(`\n❌ TIMEOUT — No response within ${TIMEOUT}ms`);
  process.exit(1);
});
