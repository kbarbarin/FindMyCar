// Client HTTP vers le backend. Fallback V1 local si le backend est down
// (l'utilisateur voit toujours quelque chose pendant un outage).

import { APP_CONFIG } from '../../config/app.config.js';

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
  const res = await fetch(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
    overview:  () => request('/api/stats/overview'),
    prices:    (q) => request('/api/stats/prices', { query: q }),
    topModels: (q) => request('/api/stats/top-models', { query: q }),
    coverage:  () => request('/api/stats/coverage'),
    volume:    (days) => request('/api/stats/volume', { query: { days } }),
  },
  isConfigured: () => Boolean(API_URL),
};
