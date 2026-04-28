// Middlewares d'authentification.
//
// Token flow : le frontend envoie l'ID token Firebase (JWT) dans l'en-tête
// `Authorization: Bearer <token>`. On le vérifie via Admin SDK et on attache
// un objet utilisateur minimal sur `req.user`. Aucun état serveur — chaque
// requête revérifie indépendamment.
//
// `requireAuth`  → 401 si token absent/invalide
// `optionalAuth` → req.user = null si absent/invalide (silencieux)

import { authService } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'auth.middleware' });

function extractBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function pickUser(decoded) {
  if (!decoded) return null;
  return {
    uid: decoded.uid,
    email: decoded.email || null,
    name: decoded.name || decoded.displayName || null,
    emailVerified: Boolean(decoded.email_verified),
  };
}

export async function requireAuth(req, res, next) {
  const token = extractBearer(req);
  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing Authorization bearer token.' });
  }
  try {
    const decoded = await authService.verifyIdToken(token);
    req.user = pickUser(decoded);
    return next();
  } catch (err) {
    log.warn('auth.verify_failed', { code: err?.code, msg: err?.message });
    const code = err?.code === 'auth/admin-not-initialized' ? 'auth_unavailable' : 'invalid_token';
    return res.status(401).json({ error: code, message: 'Invalid or expired token.' });
  }
}

export async function optionalAuth(req, _res, next) {
  const token = extractBearer(req);
  req.user = null;
  if (!token) return next();
  try {
    const decoded = await authService.verifyIdToken(token);
    req.user = pickUser(decoded);
  } catch (err) {
    log.debug('auth.optional_invalid', { code: err?.code });
  }
  return next();
}
