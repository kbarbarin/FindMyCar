// Cache in-memory simple avec TTL. Clé = JSON stable des critères.
// En V2 : Redis ou Firestore cache.

import { config } from '../config/index.js';

const store = new Map(); // key -> { value, expiresAt }

export const cacheService = {
  key(obj) {
    const pairs = Object.entries(obj).filter(([, v]) => v != null && v !== '');
    pairs.sort(([a], [b]) => a.localeCompare(b));
    return pairs.map(([k, v]) => `${k}=${Array.isArray(v) ? v.slice().sort().join(',') : v}`).join('&');
  },

  get(key) {
    const hit = store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) { store.delete(key); return null; }
    return hit.value;
  },

  set(key, value, ttlSeconds = config.cache.ttlSeconds) {
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },

  stats() {
    return { size: store.size };
  },

  clear() { store.clear(); },
};
