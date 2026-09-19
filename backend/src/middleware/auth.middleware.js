const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Authentication Middleware
 * Extracts and verifies JWT from the Authorization header (Bearer <token>).
 * Attaches decoded payload (e.g. { id, role, ... }) to req.user.
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Access denied. No authorization token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return errorResponse(res, 'Access denied. Malformed authorization token.', 401);
    }

    const secret = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
    const decoded = jwt.verify(token, secret);

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Session expired. Please log in again.', 401);
    }
    return errorResponse(res, 'Invalid authorization token.', 401);
  }
};

const optionalAuthenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const secret = process.env.JWT_SECRET || 'kisanq_jwt_super_secret_key_change_in_production';
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
      }
    }
  } catch (e) {
    // Gracefully ignore optional auth error
  }
  next();
};

module.exports = {
  authenticate,
  optionalAuthenticate
};
