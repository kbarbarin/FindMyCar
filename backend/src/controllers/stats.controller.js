import { firestoreService } from '../services/firestore.service.js';

function notAvailable(res) {
  res.status(503).json({ error: 'firestore_disabled', message: 'Firestore non configuré (voir FIREBASE_SERVICE_ACCOUNT ou GOOGLE_APPLICATION_CREDENTIALS).' });
}

export async function overview(_req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const [total, coverage, volume] = await Promise.all([
    firestoreService.totalCount(),
    firestoreService.coverageBySource(),
    firestoreService.volumeByDay({ days: 30 }),
  ]);
  res.json({ total, coverage, volume });
}

export async function prices(req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const { make, model, country, daysWindow } = req.query;
  const stats = await firestoreService.medianPrices({
    make, model, country,
    daysWindow: parseInt(daysWindow, 10) || 30,
  });
  res.json({ make: make || null, model: model || null, country: country || null, stats });
}

export async function topModels(req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const { country, limit } = req.query;
  const models = await firestoreService.topModels({ country, limit: parseInt(limit, 10) || 20 });
  res.json({ models });
}

export async function coverage(_req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const coverage = await firestoreService.coverageBySource();
  res.json({ coverage });
}

export async function volume(req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const days = parseInt(req.query.days, 10) || 30;
  const volume = await firestoreService.volumeByDay({ days });
  res.json({ volume });
}
