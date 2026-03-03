const jwt = require('jsonwebtoken');

const auth = function (req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// HIPAA §164.308(a)(4) — Role-based access control
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ msg: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ msg: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
};

module.exports = auth;
module.exports.requireRole = requireRole;
