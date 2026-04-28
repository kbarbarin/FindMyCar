import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const meRouter = Router();

// Endpoint protégé. Sert à valider la session côté client (pas indispensable
// si tu as déjà l'utilisateur dans le store, mais utile en debug et pour
// vérifier que le bearer arrive correctement).
meRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));
