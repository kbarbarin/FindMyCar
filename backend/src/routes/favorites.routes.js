import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { firestoreService } from '../services/firestore.service.js';

// Stockage des favoris dans Firestore : users/{uid}/favorites/{listingId}
// Document = snapshot léger de l'annonce + metadata.

export const favoritesRouter = Router();

function db() {
  if (!firestoreService.isEnabled()) {
    const err = new Error('firestore_disabled');
    err.status = 503;
    throw err;
  }
  return getFirestore();
}

function safeId(id) {
  return String(id).replace(/[\/#?]/g, '_');
}

// Liste les favoris de l'utilisateur courant.
favoritesRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const snap = await db()
    .collection('users').doc(req.user.uid)
    .collection('favorites')
    .orderBy('addedAt', 'desc')
    .limit(500)
    .get();
  const favorites = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  res.json({ favorites });
}));

// Ajoute un favori (POST avec un objet listing minimal { id, ...snapshot }).
favoritesRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const listing = req.body;
  if (!listing || !listing.id) {
    return res.status(400).json({ error: 'invalid_payload', message: 'Body must include a listing with an id.' });
  }
  const ref = db()
    .collection('users').doc(req.user.uid)
    .collection('favorites').doc(safeId(listing.id));
  await ref.set({
    listingId: listing.id,
    listingSnapshot: listing,
    addedAt: Timestamp.now(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  res.status(201).json({ ok: true, listingId: listing.id });
}));

// Supprime un favori.
favoritesRouter.delete('/:listingId', requireAuth, asyncHandler(async (req, res) => {
  const id = safeId(req.params.listingId);
  await db()
    .collection('users').doc(req.user.uid)
    .collection('favorites').doc(id)
    .delete();
  res.json({ ok: true, listingId: req.params.listingId });
}));
