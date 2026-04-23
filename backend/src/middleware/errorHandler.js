import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
}

// Garde-fou global. Ne jamais leak la stack en prod.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  logger.error('http.error', { path: req.originalUrl, status, msg: err.message });
  res.status(status).json({
    error: err.code || 'server_error',
    message: status >= 500 ? 'Internal server error' : err.message,
  });
}

// Petit wrapper async pour éviter les try/catch dans chaque controller.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
