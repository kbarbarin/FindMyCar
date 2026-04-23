// Index en mémoire (id → listing) alimenté après chaque recherche aggrégée.
// L'objectif est que /api/listings/:id réponde en O(1) pour une annonce que
// l'utilisateur vient juste de voir dans la liste.
//
// TTL : chaque entrée expire indépendamment. On garde ~24h pour couvrir un
// utilisateur qui revient via un lien partagé.

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 10_000; // garde-fou simple pour éviter la fuite mémoire

const store = new Map(); // id -> { listing, expiresAt }

export const listingsCache = {
  putMany(listings, ttlMs = DEFAULT_TTL_MS) {
    const expiresAt = Date.now() + ttlMs;
    for (const l of listings) {
      if (!l?.id) continue;
      store.set(l.id, { listing: l, expiresAt });
    }
    // Rotation FIFO si on explose la limite.
    while (store.size > MAX_ENTRIES) {
      const firstKey = store.keys().next().value;
      store.delete(firstKey);
    }
  },

  get(id) {
    const hit = store.get(id);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) { store.delete(id); return null; }
    return hit.listing;
  },

  stats() {
    return { size: store.size };
  },

  clear() { store.clear(); },
};
