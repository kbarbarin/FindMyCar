// Service Firestore : init Admin SDK + listings + searchCache + searchHistory + stats.
//
// 3 modes d'authentification automatiques :
//   1. FIREBASE_SERVICE_ACCOUNT=/path/to/sa.json → service account explicite
//   2. GOOGLE_APPLICATION_CREDENTIALS=/path → ADC depuis env
//   3. ~/.config/gcloud/application_default_credentials.json → ADC user (gcloud auth ADC login)
//   4. Cloud Run / Functions → metadata server (auto)
//
// Si rien n'est trouvé, le service tourne en mode no-op (warning au boot, pas
// de crash, app fonctionnelle sans persistance).

import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { logger } from '../utils/logger.js';
import { normalizeMake, normalizeModel, canonicalKey } from '../normalizers/taxonomy.js';

const log = logger.child({ service: 'firestore' });

let db = null;
let enabled = false;

function init() {
  if (getApps().length > 0) {
    db = getFirestore();
    enabled = true;
    return;
  }

  try {
    let credential;
    let mode;

    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (saPath && existsSync(saPath)) {
      credential = cert(JSON.parse(readFileSync(saPath, 'utf8')));
      mode = 'service_account_file';
    } else if (process.env.K_SERVICE || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = applicationDefault();
      mode = 'application_default_env';
    } else {
      const adcPath = join(homedir(), '.config', 'gcloud', 'application_default_credentials.json');
      if (existsSync(adcPath)) {
        credential = applicationDefault();
        mode = 'application_default_user';
      }
    }

    if (!credential) {
      log.warn('firestore.disabled', {
        reason: 'no_credentials',
        hint: 'Lance `gcloud auth application-default login` ou pose FIREBASE_SERVICE_ACCOUNT.',
      });
      return;
    }

    initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT,
    });
    db = getFirestore();
    enabled = true;
    log.info('firestore.ready', { mode, project: process.env.FIREBASE_PROJECT_ID });
  } catch (err) {
    log.error('firestore.init_failed', { msg: err.message });
  }
}

init();

// --- Helpers ---
function docIdFromListing(id) { return String(id).replace(/[\/#?]/g, '_'); }

// Stats quantiles sur un tableau deja TRIE croissant.
function quantileStats(sorted) {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return {
    count: n,
    min: sorted[0],
    max: sorted[n - 1],
    median: Math.round(n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2),
    average: Math.round(sorted.reduce((s, v) => s + v, 0) / n),
    p25: sorted[Math.floor(n * 0.25)],
    p75: sorted[Math.floor(n * 0.75)],
  };
}

function stripUndefined(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined).filter((v) => v !== undefined);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = stripUndefined(v);
  }
  return out;
}

export const firestoreService = {
  isEnabled: () => enabled,

  // --- Listings -------------------------------------------------------
  // Backfill : iterate /listings, re-applique normalizeMake/normalizeModel sur
  // les champs make/model existants, ecrit en place si la valeur a change.
  // A faire 1 fois apres avoir change la logique de normalisation.
  async normalizeAllListings({ batchSize = 400, max = 50000 } = {}) {
    if (!enabled) return { processed: 0, updated: 0 };
    const col = db.collection('listings');
    let processed = 0, updated = 0, lastDoc = null;
    while (processed < max) {
      let q = col.orderBy('__name__').limit(batchSize);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      const batch = db.batch();
      let batchUpdates = 0;
      for (const d of snap.docs) {
        const data = d.data();
        const before = { make: data.make, model: data.model };
        const make = normalizeMake(data.make);
        const model = normalizeModel(data.model);
        if (make !== before.make || model !== before.model) {
          batch.update(d.ref, {
            ...(make != null && make !== before.make && { make }),
            ...(model != null && model !== before.model && { model }),
          });
          batchUpdates++;
        }
        processed++;
        lastDoc = d;
      }
      if (batchUpdates > 0) {
        await batch.commit().catch((err) => log.warn('firestore.normalize_batch_failed', { msg: err.message }));
        updated += batchUpdates;
      }
      if (snap.size < batchSize) break;
    }
    log.info('firestore.normalize_done', { processed, updated });
    return { processed, updated };
  },

  async upsertListings(listings) {
    if (!enabled || !listings?.length) return { written: 0 };
    const col = db.collection('listings');
    const now = Timestamp.now();
    const CHUNK = 400;
    let written = 0;

    for (let i = 0; i < listings.length; i += CHUNK) {
      const batch = db.batch();
      for (const l of listings.slice(i, i + CHUNK)) {
        if (!l?.id) continue;
        const ref = col.doc(docIdFromListing(l.id));
        batch.set(ref, {
          ...stripUndefined(l),
          lastSeenAt: now,
          firstSeenAt: FieldValue.serverTimestamp(),
          seenCount: FieldValue.increment(1),
          ...(l.price?.amount != null && {
            priceHistory: FieldValue.arrayUnion({ amount: l.price.amount, currency: l.price.currency, at: now }),
          }),
        }, { merge: true });
        written++;
      }
      await batch.commit().catch((err) => log.warn('firestore.batch_failed', { msg: err.message }));
    }
    return { written };
  },

  async getListingsByIds(ids) {
    if (!enabled || !ids?.length) return [];
    const col = db.collection('listings');
    const CHUNK = 30; // limite des in-queries Firestore (était 10, élargi à 30)
    const all = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = ids.slice(i, i + CHUNK).map(docIdFromListing);
      const snap = await col.where('__name__', 'in', batch.map((id) => col.doc(id))).get()
        .catch(async () => {
          // Fallback : récupérations individuelles
          const docs = await Promise.all(batch.map((id) => col.doc(id).get()));
          return { docs };
        });
      for (const d of snap.docs) {
        if (d.exists) all.push(d.data());
      }
    }
    return all;
  },

  // --- Recherche directe dans /listings (fallback quand le scrap echoue) -
  // Renvoie les listings qui matchent au mieux les criteres en utilisant les
  // index composites disponibles. Le tri/filtre fin se fait en memoire cote
  // appelant via filterListings/sortListings.
  async searchListings(criteria = {}, { limit = 500 } = {}) {
    if (!enabled) return [];
    let q = db.collection('listings');

    // On choisit le combo le plus selectif qu'un index couvre :
    // - make + model + lastSeenAt DESC (composite)
    // - country + lastSeenAt DESC (composite)
    // - sinon orderBy lastSeenAt seul (single-field auto-indexe)
    if (criteria.make && criteria.model) {
      q = q.where('make', '==', criteria.make).where('model', '==', criteria.model);
    } else if (Array.isArray(criteria.countries) && criteria.countries.length === 1) {
      q = q.where('country', '==', criteria.countries[0]);
    }

    q = q.orderBy('lastSeenAt', 'desc').limit(limit);

    try {
      const snap = await q.get();
      return snap.docs.map((d) => d.data());
    } catch (err) {
      log.warn('firestore.search_listings_failed', { msg: err.message });
      // Fallback degraded : on tente sans where ni orderBy si l'index manque
      try {
        const snap = await db.collection('listings').limit(limit).get();
        return snap.docs.map((d) => d.data());
      } catch {
        return [];
      }
    }
  },

  // --- Cache de recherche --------------------------------------------
  // Stocke pour chaque criteriaHash : la liste d'IDs récupérée + timestamp.
  // Quand on relance la même recherche dans le TTL, on lit cette entrée
  // au lieu de re-scraper.
  async getCachedSearch(criteriaHash, { maxAgeMinutes = 360 } = {}) {
    if (!enabled) return null;
    const ref = db.collection('searchCache').doc(criteriaHash);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const data = snap.data();
    const ageMin = (Date.now() - data.cachedAt.toMillis()) / 60000;
    if (ageMin > maxAgeMinutes) return null;
    return { ...data, ageMinutes: Math.round(ageMin) };
  },

  async cacheSearch(criteriaHash, criteria, listingIds, { source = 'live' } = {}) {
    if (!enabled) return;
    const ref = db.collection('searchCache').doc(criteriaHash);
    await ref.set({
      criteria: stripUndefined(criteria),
      listingIds: listingIds.slice(0, 1000),
      cachedAt: Timestamp.now(),
      source,
    }).catch((err) => log.warn('firestore.cache_set_failed', { msg: err.message }));
  },

  // --- Historique des recherches -------------------------------------
  async recordSearch(entry) {
    if (!enabled) return;
    await db.collection('searches').add({
      ...stripUndefined(entry),
      timestamp: Timestamp.now(),
    }).catch((err) => log.warn('firestore.record_search_failed', { msg: err.message }));
  },

  // --- Stats ---------------------------------------------------------
  async medianPrices({ make, model, country, daysWindow = 30, limit = 1000 } = {}) {
    if (!enabled) return null;
    const cutoff = Timestamp.fromMillis(Date.now() - daysWindow * 86400000);
    let q = db.collection('listings').where('lastSeenAt', '>', cutoff).limit(limit);
    if (make) q = q.where('make', '==', make);
    if (model) q = q.where('model', '==', model);
    if (country) q = q.where('country', '==', country);
    const snap = await q.get();
    const prices = snap.docs.map((d) => d.data().price?.amount).filter((p) => p != null).sort((a, b) => a - b);
    if (!prices.length) return null;
    const mid = Math.floor(prices.length / 2);
    return {
      count: prices.length,
      min: prices[0], max: prices[prices.length - 1],
      median: Math.round(prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2),
      average: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
      p25: prices[Math.floor(prices.length * 0.25)],
      p75: prices[Math.floor(prices.length * 0.75)],
    };
  },

  async topModels({ country, limit = 20 } = {}) {
    if (!enabled) return [];
    // Limite reduite de 5000 -> 1500 pour limiter les reads. Au-dela de 1500
    // l'echantillon est largement suffisant pour identifier les top modeles.
    let q = db.collection('listings').select('make', 'model', 'country').limit(1500);
    if (country) q = q.where('country', '==', country);
    const snap = await q.get();
    // On groupe par canonical key (lowercase + alphanum + '+'), donc
    // 'Toyota Prius' + 'TOYOTA prius' + 'toyota Prius' fusionnent. On garde
    // la version normalisee (Title-cased) comme libelle d'affichage.
    const groups = new Map();
    for (const d of snap.docs) {
      const data = d.data();
      const make = normalizeMake(data.make);
      const model = normalizeModel(data.model);
      if (!make || !model) continue;
      const key = `${canonicalKey(make)}|${canonicalKey(model)}`;
      const entry = groups.get(key);
      if (entry) entry.count++;
      else groups.set(key, { make, model, count: 1 });
    }
    return [...groups.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  async coverageBySource() {
    if (!enabled) return [];
    // 10000 -> 2000 reads. L'echantillon de 2000 reste representatif des
    // proportions par source.
    const snap = await db.collection('listings').select('source').limit(2000).get();
    const counts = new Map();
    for (const d of snap.docs) {
      const sid = d.data().source?.id;
      if (!sid) continue;
      counts.set(sid, (counts.get(sid) || 0) + 1);
    }
    return [...counts.entries()].map(([sourceId, count]) => ({ sourceId, count })).sort((a, b) => b.count - a.count);
  },

  async breakdownByCountry({ limit = 2000 } = {}) {
    if (!enabled) return [];
    // 10000 -> 2000 par defaut (representatif, 5x moins de reads)
    const snap = await db.collection('listings').select('country').limit(limit).get();
    const counts = new Map();
    for (const d of snap.docs) {
      const c = d.data().country || 'XX';
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  },

  // Endpoint unique pour la page Marche : prend tous les criteres et renvoie
  // l'integralite des agregats + le top des annonces correspondantes. On fait
  // une SEULE query Firestore (la plus selective possible via les index
  // composites disponibles), puis on filtre/calcule tout en memoire.
  async matchListings({
    make, model, country,
    yearMin, yearMax, mileageMax, priceMin, priceMax,
    daysWindow = 60, buckets = 12, listingsLimit = 12, fetchLimit = 1000,
  } = {}) {
    if (!enabled) return null;

    // Normalise make/model AVANT la query Firestore : la base contient
    // 'Toyota' / 'Prius' (Title-cased), le user peut taper 'toyota'/'TOYOTA'.
    const normMake = make ? normalizeMake(make) : null;
    const normModel = model ? normalizeModel(model) : null;

    const cutoff = Timestamp.fromMillis(Date.now() - daysWindow * 86400000);
    let q = db.collection('listings').where('lastSeenAt', '>', cutoff);

    // Choisit la combinaison la plus selective qu'un index couvre.
    if (normMake && normModel) {
      q = q.where('make', '==', normMake).where('model', '==', normModel);
    } else if (country) {
      q = q.where('country', '==', country);
    }
    q = q.orderBy('lastSeenAt', 'desc').limit(fetchLimit);

    let docs;
    try {
      docs = (await q.get()).docs.map((d) => d.data());
    } catch (err) {
      log.warn('firestore.match_failed', { msg: err.message });
      // Degraded fallback : on retire le where compose si manquant. Limite
      // fortement reduite parce qu'on relit avec un autre cout cumulatif.
      const snap = await db.collection('listings')
        .where('lastSeenAt', '>', cutoff)
        .orderBy('lastSeenAt', 'desc')
        .limit(Math.min(500, fetchLimit))
        .get();
      docs = snap.docs.map((d) => d.data());
    }

    // Filtrage en memoire (les filtres non-indexes ou les complements)
    const filtered = docs.filter((l) => {
      if (normMake && !normModel) {
        if (canonicalKey(l.make) !== canonicalKey(normMake)) return false;
      }
      if (normModel && !normMake) {
        if (canonicalKey(l.model) !== canonicalKey(normModel)) return false;
      }
      if (country && normMake && normModel) {
        if (l.country !== country) return false;
      }
      const year = l.year;
      if (yearMin != null && (year == null || year < yearMin)) return false;
      if (yearMax != null && (year == null || year > yearMax)) return false;
      const km = l.mileageKm;
      if (mileageMax != null && (km == null || km > mileageMax)) return false;
      const price = l.price?.amount;
      if (priceMin != null && (price == null || price < priceMin)) return false;
      if (priceMax != null && (price == null || price > priceMax)) return false;
      return true;
    });

    if (filtered.length === 0) {
      return {
        total: 0, daysWindow,
        prices: null, years: null, mileage: null,
        countries: [], topModels: [], distribution: null, listings: [],
      };
    }

    // --- Stats prix ---
    const prices = filtered.map((l) => l.price?.amount).filter((p) => p != null && p > 0).sort((a, b) => a - b);
    const priceStats = prices.length ? quantileStats(prices) : null;

    // --- Stats annee ---
    const years = filtered.map((l) => l.year).filter((y) => y != null);
    const yearStats = years.length ? {
      count: years.length,
      min: Math.min(...years),
      max: Math.max(...years),
      average: Math.round(years.reduce((s, y) => s + y, 0) / years.length),
    } : null;

    // --- Stats kilometrage ---
    const km = filtered.map((l) => l.mileageKm).filter((k) => k != null && k >= 0).sort((a, b) => a - b);
    const kmStats = km.length ? quantileStats(km) : null;

    // --- Breakdown par pays ---
    const countryCounts = new Map();
    for (const l of filtered) {
      const c = l.country || 'XX';
      countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
    }
    const countriesList = [...countryCounts.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    // --- Top modeles (groupes via canonicalKey, importe avec les normalizers) ---
    const modelGroups = new Map();
    for (const l of filtered) {
      const m = normalizeMake(l.make);
      const mo = normalizeModel(l.model);
      if (!m || !mo) continue;
      const key = `${canonicalKey(m)}|${canonicalKey(mo)}`;
      const entry = modelGroups.get(key);
      if (entry) entry.count++;
      else modelGroups.set(key, { make: m, model: mo, count: 1 });
    }
    const topModels = [...modelGroups.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // --- Distribution prix (histogramme avec bornes p5-p95) ---
    let distribution = null;
    if (prices.length >= 5) {
      const lo = prices[Math.floor(prices.length * 0.05)];
      const hi = prices[Math.floor(prices.length * 0.95)] || prices[prices.length - 1];
      const step = (hi - lo) / buckets || 1;
      const dist = Array.from({ length: buckets }, (_, i) => ({
        from: Math.round(lo + i * step),
        to: Math.round(lo + (i + 1) * step),
        count: 0,
      }));
      for (const p of prices) {
        if (p < lo) { dist[0].count++; continue; }
        if (p >= hi) { dist[dist.length - 1].count++; continue; }
        const idx = Math.min(dist.length - 1, Math.floor((p - lo) / step));
        dist[idx].count++;
      }
      distribution = { total: prices.length, lo, hi, step: Math.round(step), buckets: dist };
    }

    // --- Top annonces : sort par fraicheur, on privilegie celles qui ont
    // toutes les infos critiques (prix + annee + km) pour l'affichage propre.
    const completeness = (l) => (l.price?.amount ? 1 : 0) + (l.year ? 1 : 0) + (l.mileageKm != null ? 1 : 0) + (l.photos?.[0] ? 1 : 0);
    const listings = [...filtered]
      .sort((a, b) => {
        const ca = completeness(a), cb = completeness(b);
        if (cb !== ca) return cb - ca;
        const ta = a.lastSeenAt?.toMillis?.() ?? 0;
        const tb = b.lastSeenAt?.toMillis?.() ?? 0;
        return tb - ta;
      })
      .slice(0, listingsLimit);

    return {
      total: filtered.length,
      daysWindow,
      prices: priceStats,
      years: yearStats,
      mileage: kmStats,
      countries: countriesList,
      topModels,
      distribution,
      listings,
    };
  },

  // Repartition de prix par tranche (histogramme) — utile pour la page marche
  async priceDistribution({ make, model, country, daysWindow = 60, buckets = 12 } = {}) {
    if (!enabled) return null;
    const cutoff = Timestamp.fromMillis(Date.now() - daysWindow * 86400000);
    // 5000 -> 1500 reads. Les buckets se calculent bien sur 1500 echantillons.
    let q = db.collection('listings').where('lastSeenAt', '>', cutoff).limit(1500);
    if (make) q = q.where('make', '==', make);
    if (model) q = q.where('model', '==', model);
    if (country) q = q.where('country', '==', country);
    const snap = await q.get();
    const prices = snap.docs.map((d) => d.data().price?.amount).filter((p) => p != null && p > 0);
    if (!prices.length) return null;
    prices.sort((a, b) => a - b);
    // Bornes p5 / p95 pour eviter les outliers
    const lo = prices[Math.floor(prices.length * 0.05)];
    const hi = prices[Math.floor(prices.length * 0.95)];
    const step = (hi - lo) / buckets || 1;
    const dist = Array.from({ length: buckets }, (_, i) => ({
      from: Math.round(lo + i * step),
      to: Math.round(lo + (i + 1) * step),
      count: 0,
    }));
    for (const p of prices) {
      if (p < lo) { dist[0].count++; continue; }
      if (p >= hi) { dist[dist.length - 1].count++; continue; }
      const idx = Math.min(dist.length - 1, Math.floor((p - lo) / step));
      dist[idx].count++;
    }
    return { total: prices.length, lo, hi, step: Math.round(step), buckets: dist };
  },

  async volumeByDay({ days = 30 } = {}) {
    if (!enabled) return [];
    const cutoff = Timestamp.fromMillis(Date.now() - days * 86400000);
    // 10000 -> 3000 : sur 30 jours c'est ~100 docs/jour scrapes echantillonnes,
    // largement suffisant pour la courbe de tendance.
    const snap = await db.collection('listings')
      .where('firstSeenAt', '>', cutoff)
      .select('firstSeenAt')
      .limit(3000)
      .get();
    const buckets = new Map();
    for (const d of snap.docs) {
      const ts = d.data().firstSeenAt?.toDate?.() || new Date();
      const day = ts.toISOString().slice(0, 10);
      buckets.set(day, (buckets.get(day) || 0) + 1);
    }
    return [...buckets.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async totalCount() {
    if (!enabled) return null;
    const snap = await db.collection('listings').count().get();
    return snap.data().count;
  },

  // Stats sur les recherches utilisateur (audit / analytics)
  async recentSearches({ limit = 50 } = {}) {
    if (!enabled) return [];
    const snap = await db.collection('searches').orderBy('timestamp', 'desc').limit(limit).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
};
