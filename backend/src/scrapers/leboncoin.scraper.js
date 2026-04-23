// Scraper Leboncoin.
//
// Réalité : Leboncoin est protégé par DataDome. Le moteur 'fetch' ne passera
// quasiment jamais (même avec cookies + headers parfaits). Seul le moteur
// 'browser' (Playwright) peut espérer passer de temps en temps.
//
// Parsing : le HTML contient un <script id="__NEXT_DATA__"> avec toutes les
// annonces en JSON. On extrait cette payload.

import { load } from 'cheerio';
import { BaseScraper } from './base.scraper.js';
import { normalizeLeboncoin } from '../normalizers/index.js';
import { generateForSource } from '../mocks/generator.js';

export class LeboncoinScraper extends BaseScraper {
  constructor() {
    super({
      id: 'leboncoin', label: 'Leboncoin', country: 'FR',
      baseUrl: 'https://www.leboncoin.fr',
      acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8',
      preferredEngine: 'fetch',
    });
  }

  buildSearchUrl(criteria) {
    const params = new URLSearchParams({ category: '2' });
    const q = [criteria.make, criteria.model].filter(Boolean).join(' ');
    if (q) params.set('text', q);
    if (criteria.priceMin || criteria.priceMax) params.set('price', `${criteria.priceMin ?? ''}-${criteria.priceMax ?? ''}`);
    if (criteria.mileageMin || criteria.mileageMax) params.set('mileage', `${criteria.mileageMin ?? ''}-${criteria.mileageMax ?? ''}`);
    if (criteria.yearMin || criteria.yearMax) params.set('regdate', `${criteria.yearMin ?? ''}-${criteria.yearMax ?? ''}`);
    return `${this.baseUrl}/recherche?${params.toString()}`;
  }

  parseHtml(html) {
    const $ = load(html);
    const script = $('#__NEXT_DATA__').html();
    if (!script) throw new Error('no_next_data');
    let data;
    try { data = JSON.parse(script); }
    catch { throw new Error('next_data_parse_error'); }
    const ads = data?.props?.pageProps?.searchData?.ads
      ?? data?.props?.pageProps?.initialProps?.ads
      ?? [];
    if (!Array.isArray(ads) || ads.length === 0) throw new Error('no_ads_in_payload');
    return ads.map(adToRaw);
  }

  async generateMock(criteria) { return generateForSource('leboncoin', criteria); }
  normalize(raw) { return normalizeLeboncoin(raw); }
}

function adToRaw(ad) {
  const attr = (k) => ad.attributes?.find((a) => a.key === k)?.value;
  return {
    id: String(ad.list_id ?? ad.id),
    titre: ad.subject ?? ad.title,
    prix: ad.price?.[0] ?? ad.price,
    kilometrage: attr('mileage') || '',
    annee: attr('regdate') ? parseInt(attr('regdate'), 10) : null,
    mise_en_circulation: null,
    carburant: attr('fuel'),
    boite: attr('gearbox'),
    puissance_ch: attr('horsepower_din') ? parseInt(attr('horsepower_din'), 10) : null,
    portes: attr('doors') ? parseInt(attr('doors'), 10) : null,
    places: attr('seats') ? parseInt(attr('seats'), 10) : null,
    couleur: attr('vehicule_color'),
    departement: ad.location?.department_id ?? null,
    ville: ad.location?.city ?? null,
    vendeur: ad.owner?.type ?? null,
    premiere_main: attr('issance') === '1',
    options: [],
    photos: ad.images?.urls ?? [],
    url: ad.url ?? null,
    publie_le: ad.first_publication_date ?? ad.index_date ?? null,
  };
}
