/**
 * ═══════════════════════════════════════════════════════════════════
 * K6 Load Test — Technical Made Easy API
 * IEC 62304 Performance Verification
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 * Run: k6 run tests/load/load-test.js
 * ═══════════════════════════════════════════════════════════════════
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Configuration ──
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api/v1';
const AUTH_EMAIL = __ENV.AUTH_EMAIL || 'loadtest@technical-made-easy.com';
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || 'LoadTest2026!Secure';

// ── Custom Metrics ──
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const woDuration = new Trend('work_order_duration');
const healthDuration = new Trend('health_check_duration');

// ── Test Stages (ramp-up, sustain, ramp-down) ──
export const options = {
  stages: [
    { duration: '1m', target: 20 },    // Ramp up to 20 users
    { duration: '3m', target: 50 },    // Ramp to 50 (expected load)
    { duration: '5m', target: 50 },    // Sustain expected load
    { duration: '2m', target: 100 },   // Ramp to 100 (peak stress)
    { duration: '3m', target: 100 },   // Sustain peak
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms
    errors: ['rate<0.01'],              // Error rate under 1%
    login_duration: ['p(95)<1000'],     // Login under 1s at p95
    work_order_duration: ['p(95)<500'], // WO operations under 500ms
  },
};

// ── Setup: Authenticate ──
export function setup() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: AUTH_EMAIL,
    password: AUTH_PASSWORD,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const token = loginRes.json('token');
  if (!token) {
    console.error('Login failed — check AUTH_EMAIL and AUTH_PASSWORD env vars');
    console.error(`Response: ${loginRes.status} ${loginRes.body}`);
  }

  return { token };
}

// ── Main Test Script ──
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  // ── 1. Health Check ──
  group('Health Check', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/health`);
    healthDuration.add(Date.now() - start);
    check(res, {
      'health: status 200': (r) => r.status === 200,
      'health: mongo connected': (r) => r.json('mongo') === 'connected',
    }) || errorRate.add(1);
  });

  sleep(1);

  // ── 2. Authentication Flow ──
  group('Authentication', () => {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: AUTH_EMAIL,
      password: AUTH_PASSWORD,
    }), { headers: { 'Content-Type': 'application/json' } });
    loginDuration.add(Date.now() - start);
    check(res, {
      'auth: status 200': (r) => r.status === 200,
      'auth: has token': (r) => !!r.json('token'),
    }) || errorRate.add(1);
  });

  sleep(1);

  // ── 3. Work Order Operations ──
  group('Work Orders', () => {
    // GET work orders
    const start = Date.now();
    const listRes = http.get(`${BASE_URL}/work-orders`, { headers });
    woDuration.add(Date.now() - start);
    check(listRes, {
      'wo-list: status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(0.5);

    // GET single work order (if list has results)
    if (listRes.status === 200) {
      const orders = listRes.json();
      if (Array.isArray(orders) && orders.length > 0) {
        const woRes = http.get(`${BASE_URL}/work-orders/${orders[0]._id}`, { headers });
        check(woRes, {
          'wo-detail: status 200': (r) => r.status === 200,
        }) || errorRate.add(1);
      }
    }
  });

  sleep(1);

  // ── 4. Assets/Inventory ──
  group('Assets', () => {
    const res = http.get(`${BASE_URL}/assets`, { headers });
    check(res, {
      'assets: status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  // ── 5. Clients ──
  group('Clients', () => {
    const res = http.get(`${BASE_URL}/clients`, { headers });
    check(res, {
      'clients: status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  // ── 6. Audit Logs (PHI access — tests logging performance) ──
  group('Audit Logs', () => {
    const res = http.get(`${BASE_URL}/audit`, { headers });
    check(res, {
      'audit: status 200 or 403': (r) => r.status === 200 || r.status === 403,
    }) || errorRate.add(1);
  });

  sleep(Math.random() * 2); // Randomized think time
}

// ── Teardown ──
export function teardown(data) {
  console.log('Load test complete. Review results in k6 output.');
}
