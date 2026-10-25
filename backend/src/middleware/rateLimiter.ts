import rateLimit from 'express-rate-limit';
import logger from '../config/logger';

// General API rate limiter
// A voice interview makes several requests a turn (the reply, 2-3 voice clips, the
// transcript, live words in Firefox, a heartbeat every 30 s). 100 per 15 minutes cut real
// interviews off mid-way with 429s; 1,000 still stops abuse. Health and wake-up checks are free.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  skip: (req) => req.path.startsWith('/health'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  handler: (req, res, next, options) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Rate limit exceeded');
    res.status(429).json(options.message);
  },
});

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again in 15 minutes' },
  // Never block in local development
  skip: (req) => process.env.NODE_ENV === 'development',
});

// AI endpoints limiter
export const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded, please wait a moment' },
});
