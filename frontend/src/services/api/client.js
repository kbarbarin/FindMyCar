// Client HTTP vers le backend. Fallback V1 local si le backend est down
// (l'utilisateur voit toujours quelque chose pendant un outage).
//
// Auth : si un utilisateur Firebase est connecté, on attache un header
// `Authorization: Bearer <ID token>` à chaque requête. Le SDK gère le refresh
// du token automatiquement (TTL 1h, rafraîchi à la volée par getIdToken()).
// Pas d'utilisateur -> pas de header, l'appel reste public (les routes
// publiques fonctionnent comme avant).

import { APP_CONFIG } from '../../config/app.config.js';
import { getIdToken } from '../auth/authService.js';

const API_URL = import.meta.env.VITE_API_URL || APP_CONFIG.apiUrl || '';

async function request(path, { query, method = 'GET', body } = {}) {
  if (!API_URL) throw new Error('api_not_configured');
  const url = new URL(path.startsWith('/') ? path : `/${path}`, API_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === '') continue;
      url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
  }

  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';

  // Best-effort : on récupère un ID token si dispo. Pas de blocage si l'auth
  // n'est pas configurée ou que l'utilisateur n'est pas connecté.
  try {
    const token = await getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch { /* ignore */ }

  const res = await fetch(url.toString(), {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(`api_${res.status}`);
    err.status = res.status;
    try { err.payload = await res.json(); } catch {}
    throw err;
  }
  return res.json();
}

export const apiClient = {
  health: () => request('/api/health'),
  sources: () => request('/api/sources'),
  search: (criteria) => request('/api/search', { query: criteria }),
  listing: (id) => request(`/api/listings/${encodeURIComponent(id)}`),
  estimate: (criteria) => request('/api/estimate', { query: criteria }),
  stats: {
    overview:     () => request('/api/stats/overview'),
    prices:       (q) => request('/api/stats/prices', { query: q }),
    topModels:    (q) => request('/api/stats/top-models', { query: q }),
    coverage:     () => request('/api/stats/coverage'),
    volume:       (days) => request('/api/stats/volume', { query: { days } }),
    countries:    () => request('/api/stats/countries'),
    distribution: (q) => request('/api/stats/distribution', { query: q }),
    match:        (q) => request('/api/stats/match', { query: q }),
  },
  me: () => request('/api/me'),
  favorites: {
    list:   () => request('/api/favorites'),
    add:    (listing) => request('/api/favorites', { method: 'POST', body: listing }),
    remove: (listingId) => request(`/api/favorites/${encodeURIComponent(listingId)}`, { method: 'DELETE' }),
  },
  isConfigured: () => Boolean(API_URL),
};
