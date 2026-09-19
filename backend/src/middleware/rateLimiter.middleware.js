const rateLimit = require('express-rate-limit');

/**
 * OTP Request Rate Limiter
 * Maximum 5 OTP requests per 15 minutes per IP
 */
const isDevOrTest = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevOrTest ? 500 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests from this IP. Please try again after 15 minutes.',
    timestamp: new Date().toISOString()
  }
});

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevOrTest ? 500 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    timestamp: new Date().toISOString()
  }
});

module.exports = {
  otpRateLimiter,
  loginRateLimiter
};
