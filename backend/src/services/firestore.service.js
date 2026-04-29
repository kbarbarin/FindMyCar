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
  async medianPrices({ make, model, country, daysWindow = 30, limit = 2000 } = {}) {
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
    let q = db.collection('listings').select('make', 'model', 'country').limit(5000);
    if (country) q = q.where('country', '==', country);
    const snap = await q.get();
    const counts = new Map();
    for (const d of snap.docs) {
      const data = d.data();
      if (!data.make || !data.model) continue;
      const key = `${data.make}|${data.model}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([k, count]) => { const [make, model] = k.split('|'); return { make, model, count }; })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  async coverageBySource() {
    if (!enabled) return [];
    const snap = await db.collection('listings').select('source').limit(10000).get();
    const counts = new Map();
    for (const d of snap.docs) {
      const sid = d.data().source?.id;
      if (!sid) continue;
      counts.set(sid, (counts.get(sid) || 0) + 1);
    }
    return [...counts.entries()].map(([sourceId, count]) => ({ sourceId, count })).sort((a, b) => b.count - a.count);
  },

  async volumeByDay({ days = 30 } = {}) {
    if (!enabled) return [];
    const cutoff = Timestamp.fromMillis(Date.now() - days * 86400000);
    const snap = await db.collection('listings')
      .where('firstSeenAt', '>', cutoff)
      .select('firstSeenAt')
      .limit(10000)
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
