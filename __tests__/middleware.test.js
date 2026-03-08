/**
 * Middleware Tests — Technical Made Easy Backend
 *
 * Tests the auth middleware (JWT verification) and requireRole RBAC.
 */
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';

// ── Import middleware directly ──
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

// ── Helper to create mock req/res/next ──
function mockReqResNext(headers = {}) {
  return {
    req: { header: jest.fn((key) => headers[key]) },
    res: {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    },
    next: jest.fn(),
  };
}

// ══════════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE TESTS
// ══════════════════════════════════════════════════════════════
describe('Auth Middleware', () => {
  test('rejects request with no token', () => {
    const { req, res, next } = mockReqResNext({});

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ msg: 'No token, authorization denied' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects request with invalid token', () => {
    const { req, res, next } = mockReqResNext({ Authorization: 'Bearer invalid-garbage-token' });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts valid token and sets req.user', () => {
    const token = jwt.sign(
      { user: { id: 'user-1', role: 'ADMIN', companyId: 'c1' } },
      process.env.JWT_SECRET,
    );
    const { req, res, next } = mockReqResNext({ Authorization: `Bearer ${token}` });

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-1', role: 'ADMIN', companyId: 'c1' });
  });

  test('rejects token without Bearer prefix', () => {
    const token = jwt.sign(
      { user: { id: 'user-2', role: 'TECH', companyId: 'c1' } },
      process.env.JWT_SECRET,
    );
    const { req, res, next } = mockReqResNext({ Authorization: token });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════
//  REQUIRE ROLE TESTS
// ══════════════════════════════════════════════════════════════
describe('requireRole Middleware', () => {
  test('allows user with correct role', () => {
    const middleware = requireRole('ADMIN', 'OWNER');
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'ADMIN' };

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('blocks user with wrong role', () => {
    const middleware = requireRole('ADMIN', 'OWNER');
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'TECH' };

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('OWNER role is always accepted when in allowed list', () => {
    const middleware = requireRole('OWNER');
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'OWNER' };

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('CLIENT role cannot access admin endpoints', () => {
    const middleware = requireRole('OWNER', 'COMPANY', 'ADMIN');
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'CLIENT' };

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
