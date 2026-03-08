/**
 * Auth Route Tests — Technical Made Easy Backend
 *
 * Tests the authentication endpoints: login, register, MFA, and /me.
 * Uses mocked Mongoose models to avoid needing a real database.
 */
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ── Mock environment ──
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';

// ── Mock User model ──
const mockUser = {
  id: 'test-user-id',
  _id: 'test-user-id',
  role: 'ADMIN',
  name: 'Test User',
  email: 'test@example.com',
  companyId: 'c1',
  accountNumber: null,
  avatar: 'TU',
  preferences: {},
  clientCompany: null,
  techSkill: null,
  active: true,
  matchPassword: jest.fn(),
  save: jest.fn(),
};

jest.mock('../models/User', () => {
  const MockUser = jest.fn().mockImplementation((data) => ({
    ...data,
    id: 'new-user-id',
    save: jest.fn().mockResolvedValue(true),
  }));
  MockUser.findOne = jest.fn();
  MockUser.findById = jest.fn();
  return MockUser;
});

// ── Mock MfaCode model (MongoDB-backed MFA) ──
jest.mock('../models/MfaCode', () => {
  const MockMfaCode = jest.fn();
  MockMfaCode.findOneAndUpdate = jest.fn().mockResolvedValue({ key: 'test', code: '123456' });
  MockMfaCode.findOne = jest.fn().mockResolvedValue(null); // default: no code found
  MockMfaCode.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
  return MockMfaCode;
});

// ── Build a mini Express app with just the auth routes ──
const User = require('../models/User');
const authRouter = require('../routes/auth');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  return app;
}

// ══════════════════════════════════════════════════════════════
//  LOGIN TESTS
// ══════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/login', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'test123' });

    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('Validation failed');
  });

  test('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('Validation failed');
  });

  test('returns 400 for invalid credentials (user not found)', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong' });

    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('Invalid Credentials');
  });

  test('returns 403 for deactivated account', async () => {
    User.findOne.mockResolvedValue({ ...mockUser, active: false });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'pass' });

    expect(res.status).toBe(403);
    expect(res.body.msg).toContain('deactivated');
  });

  test('returns 400 for wrong password', async () => {
    const userCopy = { ...mockUser, matchPassword: jest.fn().mockResolvedValue(false) };
    User.findOne.mockResolvedValue(userCopy);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'wrong' });

    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('Invalid Credentials');
  });

  test('returns token and user on successful login', async () => {
    const userCopy = { ...mockUser, matchPassword: jest.fn().mockResolvedValue(true) };
    User.findOne.mockResolvedValue(userCopy);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'correct' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('id', 'test-user-id');
    expect(res.body.user).toHaveProperty('role', 'ADMIN');
    expect(res.body.user).toHaveProperty('email', 'test@example.com');

    // Verify the token is a valid JWT
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.user.id).toBe('test-user-id');
  });
});

// ══════════════════════════════════════════════════════════════
//  REGISTER TESTS
// ══════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/register', () => {
  let app, ownerToken, adminToken;

  beforeAll(() => {
    // Create tokens for different roles
    ownerToken = jwt.sign({ user: { id: 'owner-1', role: 'OWNER', companyId: null } }, process.env.JWT_SECRET);
    adminToken = jwt.sign({ user: { id: 'admin-1', role: 'ADMIN', companyId: 'c1' } }, process.env.JWT_SECRET);
  });

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: 'test@example.com', password: 'Test@1234' });

    expect(res.status).toBe(401);
  });

  test('rejects weak passwords', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test', email: 'new@example.com', password: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('Validation failed');
    expect(res.body.errors.some((e) => e.field === 'password')).toBe(true);
  });

  test('rejects invalid role values', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test', email: 'new@example.com', password: 'Strong@1234', role: 'SUPERADMIN' });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'role')).toBe(true);
  });

  test('ADMIN cannot create COMPANY-level users', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test', email: 'new@example.com', password: 'Strong@1234', role: 'COMPANY' });

    expect(res.status).toBe(403);
    expect(res.body.msg).toContain('OWNER');
  });

  test('OWNER can create COMPANY-level users', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'New Admin', email: 'new@company.com', password: 'Strong@1234', role: 'COMPANY' });

    expect(res.status).toBe(201);
    expect(res.body.msg).toContain('created');
  });

  test('rejects duplicate email', async () => {
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Dup', email: 'test@example.com', password: 'Strong@1234' });

    expect(res.status).toBe(400);
    expect(res.body.msg).toContain('already exists');
  });
});

// ══════════════════════════════════════════════════════════════
//  MFA TESTS
// ══════════════════════════════════════════════════════════════
describe('MFA Endpoints', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('send-code requires userId or email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/mfa/send-code')
      .send({});

    expect(res.status).toBe(400);
  });

  test('send-code succeeds with valid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/mfa/send-code')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.msg).toContain('sent');
  });

  test('verify-code rejects invalid code format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/mfa/verify-code')
      .send({ email: 'test@example.com', code: 'abc' });

    expect(res.status).toBe(400);
  });

  test('verify-code rejects code with no prior send', async () => {
    const res = await request(app)
      .post('/api/v1/auth/mfa/verify-code')
      .send({ email: 'unknown@example.com', code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.msg).toContain('No code found');
  });
});

// ══════════════════════════════════════════════════════════════
//  GET /me TESTS
// ══════════════════════════════════════════════════════════════
describe('GET /api/v1/auth/me', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns current user when authenticated', async () => {
    const token = jwt.sign({ user: { id: 'test-user-id', role: 'ADMIN', companyId: 'c1' } }, process.env.JWT_SECRET);
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'Test User');
  });
});
