import { firestoreService } from '../services/firestore.service.js';
import { cacheService } from '../services/cache.service.js';

// Cache backend pour les endpoints stats. Les reads Firestore explosaient :
// chaque visite a /stats coute ~20k reads (overview + match) et le user peut
// rafraichir / changer de filtre plusieurs fois pendant un deep scrape.
// Avec un cache in-memory TTL, les visites repetees coutent 0 read.
//
// TTL court pour les endpoints filtres (le user peut esperer voir le delta
// apres deep scrape au bout de quelques minutes), plus long pour les vues
// globales qui bougent peu.
const TTL = {
  global: 600,   // 10 min : overview, coverage, countries, volume — peu de variation
  filtered: 120, // 2 min : prices, distribution, topModels avec filtres, match
};

function notAvailable(res) {
  res.status(503).json({ error: 'firestore_disabled', message: 'Firestore non configuré (voir FIREBASE_SERVICE_ACCOUNT ou GOOGLE_APPLICATION_CREDENTIALS).' });
}

// Wrapper : si la cle est en cache, retourne, sinon execute fn et stocke.
async function withCache(name, params, ttlSeconds, fn) {
  const key = `${name}:${cacheService.key(params)}`;
  const hit = cacheService.get(key);
  if (hit) return hit;
  const value = await fn();
  cacheService.set(key, value, ttlSeconds);
  return value;
}

export async function overview(_req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const data = await withCache('overview', {}, TTL.global, async () => {
    const [total, coverage, volume] = await Promise.all([
      firestoreService.totalCount(),
      firestoreService.coverageBySource(),
      firestoreService.volumeByDay({ days: 30 }),
    ]);
    return { total, coverage, volume };
  });
  res.json(data);
}

export async function prices(req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const { make, model, country, daysWindow } = req.query;
  const params = { make, model, country, daysWindow };
  const data = await withCache('prices', params, TTL.filtered, async () => {
    const stats = await firestoreService.medianPrices({
      make, model, country,
      daysWindow: parseInt(daysWindow, 10) || 30,
    });
    return { make: make || null, model: model || null, country: country || null, stats };
  });
  res.json(data);
}

export async function topModels(req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const { country, limit } = req.query;
  const params = { country, limit };
  const data = await withCache('topModels', params, TTL.filtered, async () => {
    const models = await firestoreService.topModels({ country, limit: parseInt(limit, 10) || 20 });
    return { models };
  });
  res.json(data);
}

export async function coverage(_req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const data = await withCache('coverage', {}, TTL.global, async () => {
    const coverage = await firestoreService.coverageBySource();
    return { coverage };
  });
  res.json(data);
}

export async function volume(req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const days = parseInt(req.query.days, 10) || 30;
  const data = await withCache('volume', { days }, TTL.global, async () => {
    const volume = await firestoreService.volumeByDay({ days });
    return { volume };
  });
  res.json(data);
}

export async function countries(_req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const data = await withCache('countries', {}, TTL.global, async () => {
    const breakdown = await firestoreService.breakdownByCountry();
    return { countries: breakdown };
  });
  res.json(data);
}

export async function distribution(req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const { make, model, country, daysWindow, buckets } = req.query;
  const params = { make, model, country, daysWindow, buckets };
  const data = await withCache('distribution', params, TTL.filtered, async () => {
    const dist = await firestoreService.priceDistribution({
      make, model, country,
      daysWindow: parseInt(daysWindow, 10) || 60,
      buckets: parseInt(buckets, 10) || 12,
    });
    return { distribution: dist };
  });
  res.json(data);
}

export async function match(req, res) {
  if (!firestoreService.isEnabled()) return notAvailable(res);
  const q = req.query;
  const toNum = (v) => {
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const params = {
    make: q.make, model: q.model, country: q.country,
    yearMin: q.yearMin, yearMax: q.yearMax,
    mileageMax: q.mileageMax, priceMin: q.priceMin, priceMax: q.priceMax,
    daysWindow: q.daysWindow, buckets: q.buckets, listingsLimit: q.listingsLimit,
  };
  const data = await withCache('match', params, TTL.filtered, async () => {
    return firestoreService.matchListings({
      make: q.make || undefined,
      model: q.model || undefined,
      country: q.country || undefined,
      yearMin: toNum(q.yearMin),
      yearMax: toNum(q.yearMax),
      mileageMax: toNum(q.mileageMax),
      priceMin: toNum(q.priceMin),
      priceMax: toNum(q.priceMax),
      daysWindow: toNum(q.daysWindow) || 60,
      buckets: toNum(q.buckets) || 12,
      listingsLimit: toNum(q.listingsLimit) || 12,
    });
  });
  res.json(data || { total: 0 });
}
