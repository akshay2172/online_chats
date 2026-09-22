import { rateLimit } from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (_request, response) => {
    response.status(429).json({
      message: 'Too many attempts, please try again later',
    });
  },
});
