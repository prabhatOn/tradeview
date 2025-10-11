/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

const normalizeRoles = (roles) => {
  if (!roles) return [];
  return roles
    .split(',')
    .map((role) => (typeof role === 'string' ? role.trim() : ''))
    .filter(Boolean);
};

const fetchUserById = async (userId) => {
  const users = await executeQuery(
    `SELECT u.id, u.uuid, u.email, u.first_name, u.last_name, u.status, u.kyc_status,
            GROUP_CONCAT(r.name) as roles
     FROM users u
     LEFT JOIN user_roles ur ON u.id = ur.user_id
     LEFT JOIN roles r ON ur.role_id = r.id
     WHERE u.id = ? AND u.status = 'active'
     GROUP BY u.id`,
    [userId]
  );

  if (!users.length) {
    return null;
  }

  const user = users[0];
  user.roles = normalizeRoles(user.roles);

  if (Array.isArray(user.roles) && user.roles.length) {
    [user.role] = user.roles;
  }

  return user;
};

// Authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await fetchUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token or user not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin middleware - requires authentication first
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const hasAdminPrivileges = Array.isArray(req.user.roles)
    ? req.user.roles.some((role) => {
        if (typeof role !== 'string') return false;
        const normalized = role.trim().toLowerCase();
        return normalized === 'admin' || normalized === 'manager';
      })
    : false;

  if (!hasAdminPrivileges) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await fetchUserById(decoded.userId);

    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('Optional auth skipped:', error instanceof Error ? error.message : error);
    }
    next();
  }
};

// Generate JWT token
const generateToken = (userId) =>
  jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });

// Verify JWT token
const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

module.exports = {
  authMiddleware,
  adminMiddleware,
  optionalAuth,
  generateToken,
  verifyToken,
};