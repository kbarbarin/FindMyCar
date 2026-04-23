// Scraper La Centrale. SSR + Akamai. Sans proxy : fetch peut marcher quelques
// requêtes puis se prendre un challenge. Browser = meilleure fiabilité.

import { load } from 'cheerio';
import { BaseScraper } from './base.scraper.js';
import { normalizeLacentrale } from '../normalizers/index.js';
import { generateForSource } from '../mocks/generator.js';

export class LacentraleScraper extends BaseScraper {
  constructor() {
    super({
      id: 'lacentrale', label: 'La Centrale', country: 'FR',
      baseUrl: 'https://www.lacentrale.fr',
      acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8',
      // Akamai Bot Manager bloque autant fetch QUE Playwright (TLS fingerprinting).
      // Réactiver seulement avec un proxy résidentiel ou un moteur spécialisé
      // comme puppeteer-extra-plugin-stealth.
      preferredEngine: 'browser',
    });
    this.enabled = process.env.ENABLE_LACENTRALE === 'true';
  }

  buildSearchUrl(criteria) {
    const q = [criteria.make, criteria.model].filter(Boolean).join(' ');
    const params = new URLSearchParams();
    if (q) params.set('searchQuery', q);
    if (criteria.yearMin) params.set('yearMin', criteria.yearMin);
    if (criteria.yearMax) params.set('yearMax', criteria.yearMax);
    if (criteria.mileageMax) params.set('mileageMax', criteria.mileageMax);
    if (criteria.priceMax) params.set('priceMax', criteria.priceMax);
    return `${this.baseUrl}/listing?${params.toString()}`;
  }

  parseHtml(html) {
    // 1. Essai : Nuxt hydration
    const nuxtMatch = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (nuxtMatch) {
      try {
        const payload = JSON.parse(nuxtMatch[1]);
        const ads = extractAdsFromNuxt(payload);
        if (ads.length) return ads.map(adToRaw);
      } catch { /* fallback */ }
    }
    // 2. Fallback : parsing des cards
    const $ = load(html);
    const raws = [];
    $('article[data-testid="ad-card"], article.searchCard').each((_, el) => {
      const r = cardToRaw($(el));
      if (r.reference) raws.push(r);
    });
    if (raws.length === 0) throw new Error('no_cards_found');
    return raws;
  }

  async generateMock(criteria) { return generateForSource('lacentrale', criteria); }
  normalize(raw) { return normalizeLacentrale(raw); }
}

function extractAdsFromNuxt(payload) {
  if (!Array.isArray(payload)) return [];
  const ads = [];
  for (const node of payload) {
    if (node && typeof node === 'object' && node.classified) ads.push(node.classified);
    if (Array.isArray(node?.classifieds)) ads.push(...node.classifieds);
  }
  return ads;
}

function adToRaw(ad) {
  return {
    reference: String(ad.id ?? ad.classifiedId ?? ad.reference),
    marque: ad.make ?? ad.makeLabel,
    modele: ad.model ?? ad.modelLabel,
    finition: ad.versionLabel ?? ad.trim ?? null,
    prix_ttc: ad.price ?? ad.customerPrice,
    km: ad.mileage,
    annee_modele: ad.year ?? null,
    mec: ad.firstRegistrationDate ?? null,
    energie: ad.energy ?? ad.fuelType,
    transmission: ad.gearbox,
    ch_din: ad.power ?? null,
    nb_portes: ad.doors ?? null,
    nb_places: ad.seats ?? null,
    couleur_ext: ad.exteriorColor,
    departement: ad.departmentCode ?? null,
    localite: ad.city,
    type_vendeur: ad.sellerType ?? 'pro',
    premiere_main: ad.firstHand ?? null,
    equipements: ad.options ?? [],
    photos: ad.pictures?.map((p) => p.url) ?? [],
    deeplink: ad.url,
    mis_en_ligne: ad.updateDate ?? ad.publicationDate ?? null,
    historique: { accident: ad.accidented ?? null, carnet_complet: ad.serviceBookComplete ?? null },
  };
}

function cardToRaw($card) {
  const text = (sel) => $card.find(sel).first().text().trim();
  const href = $card.find('a').first().attr('href');
  return {
    reference: href ? href.split('/').pop()?.replace('.html', '') : null,
    marque: text('[data-testid="make"]'),
    modele: text('[data-testid="model"]'),
    finition: text('[data-testid="version"]'),
    prix_ttc: parseInt(text('[data-testid="price"]').replace(/[^\d]/g, ''), 10) || null,
    km: parseInt(text('[data-testid="mileage"]').replace(/[^\d]/g, ''), 10) || null,
    annee_modele: parseInt(text('[data-testid="year"]'), 10) || null,
    mec: null, energie: text('[data-testid="energy"]'),
    transmission: text('[data-testid="gearbox"]'),
    ch_din: null, nb_portes: null, nb_places: null,
    couleur_ext: null, departement: null,
    localite: text('[data-testid="city"]'),
    type_vendeur: 'pro', premiere_main: null, equipements: [],
    photos: $card.find('img').map((i, el) => $card.find('img').eq(i).attr('src')).get(),
    deeplink: href ? (href.startsWith('http') ? href : `https://www.lacentrale.fr${href}`) : null,
    mis_en_ligne: null, historique: {},
  };
}
