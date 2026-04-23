// Subito.it — grand site d'annonces italien. Rendu côté client (Next.js),
// les résultats sont dans __NEXT_DATA__.

import { load } from 'cheerio';
import { BaseScraper } from './base.scraper.js';
import { normalizeSubito } from '../normalizers/index.js';

export class SubitoScraper extends BaseScraper {
  constructor() {
    super({
      id: 'subito', label: 'Subito', country: 'IT',
      baseUrl: 'https://www.subito.it',
      acceptLanguage: 'it-IT,it;q=0.9,en;q=0.6',
      preferredEngine: 'fetch',
    });
  }

  buildSearchUrl(criteria) {
    const q = [criteria.make, criteria.model].filter(Boolean).join(' ');
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (criteria.priceMax) params.set('ps', criteria.priceMax);
    if (criteria.yearMin) params.set('af', criteria.yearMin);
    const qs = params.toString();
    return `${this.baseUrl}/annunci-italia/vendita/auto/${qs ? `?${qs}` : ''}`;
  }

  parseHtml(html) {
    const $ = load(html);
    const script = $('#__NEXT_DATA__').html();
    if (!script) throw new Error('no_next_data');
    let data;
    try { data = JSON.parse(script); }
    catch { throw new Error('next_data_parse_error'); }

    const ads = findAdsInNextData(data);
    if (!ads.length) throw new Error('no_ads_in_payload');
    return ads.map(adToRaw);
  }

  normalize(raw) { return normalizeSubito(raw); }
}

function findAdsInNextData(data) {
  // Structure Next.js variable : on cherche un tableau dans pageProps.
  const pp = data?.props?.pageProps ?? {};
  const candidates = [pp.ads, pp.items, pp.listings, pp.searchAds, pp.initialState?.items];
  for (const c of candidates) if (Array.isArray(c) && c.length) return c;
  // Dernier recours : scanner récursivement.
  const ads = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    if (node.urn && node.subject) ads.push(node);
    if (node.ad && node.ad.subject) ads.push(node.ad);
    for (const v of Object.values(node)) walk(v);
  })(pp);
  return ads;
}

function adToRaw(ad) {
  // Subito stocke les "features" dans un tableau d'objets { uri, values }
  const features = ad.features || {};
  const get = (key) => features[key]?.values?.[0]?.key || features[key]?.values?.[0]?.value || null;
  return {
    id: String(ad.urn || ad.id || ad.legacyId),
    title: ad.subject,
    make: get('/brand') || get('marca'),
    model: get('/model') || get('modello'),
    version: get('/versione'),
    price: parseInt(ad.features?.price?.values?.[0]?.key || '0', 10) || null,
    mileage: get('mileage') || get('chilometraggio'),
    year: parseInt(get('year') || get('anno') || '0', 10) || null,
    firstRegistration: null,
    fuel: get('fuel') || get('carburante'),
    transmission: get('gearbox') || get('cambio'),
    powerHp: parseInt(get('horse_power_car') || '0', 10) || null,
    city: ad.geo?.city?.value || ad.geo?.town?.value || null,
    region: ad.geo?.region?.value || null,
    seller: ad.advertiser?.type || 'private',
    photos: (ad.images || []).map((img) => img.scale?.[img.scale.length - 1]?.secureuri || img.url).filter(Boolean),
    postedAt: ad.date || null,
    url: ad.urls?.default || (ad.urn ? `https://www.subito.it/auto/${ad.urn}.htm` : null),
  };
}
