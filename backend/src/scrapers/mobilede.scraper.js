// Scraper Mobile.de. Akamai protégé. Accept-Language allemand recommandé pour
// éviter la détection "UA france qui visite un site allemand".

import { load } from 'cheerio';
import { BaseScraper } from './base.scraper.js';
import { normalizeMobilede } from '../normalizers/index.js';
import { generateForSource } from '../mocks/generator.js';

export class MobiledeScraper extends BaseScraper {
  constructor() {
    super({
      id: 'mobilede', label: 'Mobile.de', country: 'DE',
      baseUrl: 'https://suchen.mobile.de',
      acceptLanguage: 'de-DE,de;q=0.9,en;q=0.6',
      // Akamai Bot Manager, même constat que LaCentrale. Désactivé par défaut.
      preferredEngine: 'browser',
    });
    this.enabled = process.env.ENABLE_MOBILEDE === 'true';
  }

  buildSearchUrl(criteria) {
    const params = new URLSearchParams({ s: 'Car' });
    const q = [criteria.make, criteria.model].filter(Boolean).join(' ');
    if (q) params.set('query', q);
    if (criteria.yearMin) params.set('fr', String(criteria.yearMin));
    if (criteria.yearMax) params.set('frTo', String(criteria.yearMax));
    if (criteria.mileageMax) params.set('ms', String(criteria.mileageMax));
    if (criteria.priceMax) params.set('pri', String(criteria.priceMax));
    return `${this.baseUrl}/fahrzeuge/search.html?${params.toString()}`;
  }

  parseHtml(html) {
    const stateMatch = html.match(/<script[^>]*id="__INITIAL_STATE__"[^>]*>([^<]+)<\/script>/);
    if (stateMatch) {
      try {
        const state = JSON.parse(decodeHtmlEntities(stateMatch[1]));
        const ads = extractAdsFromState(state);
        if (ads.length) return ads.map(adToRaw);
      } catch { /* fallback */ }
    }
    const $ = load(html);
    const raws = [];
    $('.cBox-body--resultitem').each((_, el) => {
      const r = cardToRaw($(el));
      if (r.ref) raws.push(r);
    });
    if (raws.length === 0) throw new Error('no_results_in_dom');
    return raws;
  }

  async generateMock(criteria) { return generateForSource('mobilede', criteria); }
  normalize(raw) { return normalizeMobilede(raw); }
}

function decodeHtmlEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function extractAdsFromState(state) {
  const ads = [];
  function walk(node) {
    if (!node) return;
    if (typeof node === 'object') {
      if (Array.isArray(node.listings)) ads.push(...node.listings);
      if (Array.isArray(node.items)) ads.push(...node.items);
      for (const v of Object.values(node)) walk(v);
    }
  }
  walk(state);
  return ads;
}

function adToRaw(ad) {
  return {
    ref: String(ad.id ?? ad.mobileAdId),
    make: ad.make ?? ad.makeName,
    model: ad.model ?? ad.modelName,
    trim: ad.modelDescription ?? null,
    firstRegistration: ad.firstRegistration ?? ad.firstRegistrationDate ?? null,
    mileageKm: ad.mileage,
    priceEUR: ad.price?.grossAmount ?? ad.price?.amount ?? ad.price,
    fuelType: ad.fuel ?? ad.fuelType,
    gearbox: ad.gearbox ?? ad.transmission,
    powerKW: ad.power?.kw ?? ad.powerInKw ?? null,
    doors: ad.doors, seats: ad.seats,
    color: ad.exteriorColor,
    country: 'DE', city: ad.city ?? ad.location?.city,
    sellerType: ad.sellerType ?? 'dealer',
    features: ad.features ?? ad.equipment ?? [],
    images: ad.images?.map((i) => i.url) ?? [],
    url: ad.detailPageUrl ?? null,
    listedAt: ad.creationDate ?? null,
    accidentFree: ad.accidentFree ?? null,
    fullServiceHistory: ad.fullServiceHistory ?? null,
  };
}

function cardToRaw($card) {
  const href = $card.find('a').first().attr('href');
  const text = (sel) => $card.find(sel).first().text().trim();
  return {
    ref: href ? href.split('/').pop()?.replace('.html', '') : null,
    make: null, model: text('.headline-block .h3-headline'),
    firstRegistration: null, mileageKm: null,
    priceEUR: parseInt(text('.h3').replace(/[^\d]/g, ''), 10) || null,
    trim: null, fuelType: null, gearbox: null, powerKW: null,
    doors: null, seats: null, color: null,
    country: 'DE', city: text('.u-text-muted'),
    sellerType: 'dealer', features: [], images: [],
    url: href ? (href.startsWith('http') ? href : `https://suchen.mobile.de${href}`) : null,
    listedAt: null, accidentFree: null, fullServiceHistory: null,
  };
}
