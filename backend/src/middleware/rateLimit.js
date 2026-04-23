import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.maxPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Trop de requêtes, réessayez plus tard.' },
});
