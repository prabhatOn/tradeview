/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-super-secret-refresh-token-change-in-production';

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
    // Debug: log incoming request and token presence (do not log token values)
    try {
      const incoming = `${req.method} ${req.originalUrl || req.url}`
      console.debug(`[auth] Incoming request: ${incoming}`)
    } catch {
      // ignore logging errors
    }
    // Try Authorization header first, then fallback to accessToken cookie
    const authHeader = req.header('Authorization')
    let token = authHeader?.replace('Bearer ', '')

    // helper to parse cookie header if cookie-parser isn't installed
    const parseCookie = (cookieHeader) => {
      if (!cookieHeader) return {}
      return cookieHeader.split(';').map(c => c.trim()).reduce((acc, pair) => {
        const idx = pair.indexOf('=')
        if (idx === -1) return acc
        const key = pair.slice(0, idx)
        const val = pair.slice(idx + 1)
        acc[key] = decodeURIComponent(val)
        return acc
      }, {})
    }

    if (!token) {
      // express may expose parsed cookies on req.cookies if cookie-parser is used
      if (req.cookies && req.cookies.accessToken) {
        console.debug('[auth] Token found in req.cookies')
        token = req.cookies.accessToken
      } else if (req.headers && req.headers.cookie) {
        const parsed = parseCookie(req.headers.cookie)
        if (parsed.accessToken) token = parsed.accessToken
        if (parsed.accessToken) console.debug('[auth] Token found in cookie header')
      }
    }

    if (!token) {
      console.debug('[auth] No token provided')
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

  const decoded = verifyAccessToken(token);
    const user = await fetchUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token or user not found.' });
    }

    // Debug: log resolved user id and roles for troubleshooting admin checks
    try {
      console.debug(`[auth] Resolved user id=${user.id} roles=${JSON.stringify(user.roles)}`)
    } catch {
      // ignore
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
        return (
          normalized === 'admin' ||
          normalized === 'manager' ||
          normalized === 'super admin' ||
          normalized === 'super_admin'
        );
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
    const authHeader = req.header('Authorization')
    let token = authHeader?.replace('Bearer ', '')

    const parseCookie = (cookieHeader) => {
      if (!cookieHeader) return {}
      return cookieHeader.split(';').map(c => c.trim()).reduce((acc, pair) => {
        const idx = pair.indexOf('=')
        if (idx === -1) return acc
        const key = pair.slice(0, idx)
        const val = pair.slice(idx + 1)
        acc[key] = decodeURIComponent(val)
        return acc
      }, {})
    }

    if (!token) {
      if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken
      } else if (req.headers && req.headers.cookie) {
        const parsed = parseCookie(req.headers.cookie)
        if (parsed.accessToken) token = parsed.accessToken
      }
    }

    if (!token) {
      return next();
    }

  const decoded = verifyAccessToken(token);
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

// Generate access token
const generateAccessToken = (userId) =>
  jwt.sign({ userId, type: 'access' }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });

// Generate refresh token (signed with different secret)
const generateRefreshToken = (userId) =>
  jwt.sign({ userId, type: 'refresh' }, REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_EXPIRES_IN || '30d',
  });

// Verify access token
const verifyAccessToken = (token) => jwt.verify(token, JWT_SECRET);

// Verify refresh token
const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_TOKEN_SECRET);

module.exports = {
  authMiddleware,
  adminMiddleware,
  optionalAuth,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};