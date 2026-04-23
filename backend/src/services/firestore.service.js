// Service Firestore : init Admin SDK + upsert listings + queries pour stats.
//
// Mode de fonctionnement :
//   - Sur Cloud Run/Cloud Functions : l'auth est automatique via ADC.
//   - En local : FIREBASE_SERVICE_ACCOUNT peut pointer vers un fichier JSON, ou
//     on essaye les credentials par défaut (gcloud auth application-default login).
//   - Si aucun project ID trouvé → les écritures sont NOOP (le backend tourne
//     sans plantage mais avec un warning).

import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'firestore' });

let db = null;
let enabled = false;

function init() {
  if (getApps().length > 0) return;

  try {
    let credential;
    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (saPath) {
      const sa = JSON.parse(readFileSync(saPath, 'utf8'));
      credential = cert(sa);
      log.info('firestore.init', { mode: 'service_account_file' });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE) {
      // Cloud Run / Functions ou gcloud ADC
      credential = applicationDefault();
      log.info('firestore.init', { mode: 'application_default' });
    } else {
      log.warn('firestore.disabled', { reason: 'no_credentials' });
      return;
    }

    initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT,
    });
    db = getFirestore();
    enabled = true;
    log.info('firestore.ready');
  } catch (err) {
    log.error('firestore.init_failed', { msg: err.message });
  }
}

init();

// --- Upsert listings ---------------------------------------------------
// On veut traquer les évolutions de prix / disparitions. À chaque fois
// qu'une annonce est (re)vue, on met à jour lastSeenAt et on incrémente
// seenCount. Si le prix a changé, on push l'ancien dans priceHistory.
export const firestoreService = {
  isEnabled: () => enabled,

  async upsertListings(listings) {
    if (!enabled || !listings?.length) return { written: 0 };
    const col = db.collection('listings');
    const now = Timestamp.now();

    // Firestore = 500 opérations max par batch. On chunke.
    const CHUNK = 400;
    let written = 0;
    for (let i = 0; i < listings.length; i += CHUNK) {
      const batch = db.batch();
      for (const l of listings.slice(i, i + CHUNK)) {
        if (!l?.id) continue;
        const ref = col.doc(docIdFromListing(l.id));

        // Champ "merge" qui ne cassse pas priceHistory si déjà existant.
        batch.set(ref, {
          ...stripUndefined(l),
          lastSeenAt: now,
          firstSeenAt: FieldValue.arrayUnion ? FieldValue.serverTimestamp() : now, // idempotent-ish
          seenCount: FieldValue.increment(1),
          priceHistory: l.price?.amount != null
            ? FieldValue.arrayUnion({ amount: l.price.amount, currency: l.price.currency, at: now })
            : FieldValue.delete(),
        }, { merge: true });

        written++;
      }
      await batch.commit().catch((err) => log.warn('firestore.batch_failed', { msg: err.message }));
    }
    return { written };
  },

  // Stats : médiane prix par make+model (toutes années)
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

  // Top modèles (les plus scrapés)
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

  // Couverture par source
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

  // Évolution du nombre d'annonces jour par jour (7 ou 30 derniers jours)
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
    // Firestore count() agrégation (moderne)
    const snap = await db.collection('listings').count().get();
    return snap.data().count;
  },
};

function docIdFromListing(id) {
  // Les / ne sont pas autorisés comme doc ID. Notre format est "source:ref"
  // qui contient ":" — pas un souci pour Firestore mais sanitize par précaution.
  return String(id).replace(/[\/#?]/g, '_');
}

function stripUndefined(obj) {
  // Firestore refuse les undefined. On les strip récursivement.
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined).filter((v) => v !== undefined);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = stripUndefined(v);
  }
  return out;
}
