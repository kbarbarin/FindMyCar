// Scraper AutoScout24. SPA Next.js, DataDome-like protection. Le mode browser
// est indispensable pour obtenir un HTML complet avec __NEXT_DATA__.

import { load } from 'cheerio';
import { BaseScraper } from './base.scraper.js';
import { normalizeAutoscout24 } from '../normalizers/index.js';
import { generateForSource } from '../mocks/generator.js';

export class Autoscout24Scraper extends BaseScraper {
  constructor() {
    super({
      id: 'autoscout24', label: 'AutoScout24', country: 'DE',
      baseUrl: 'https://www.autoscout24.com',
      acceptLanguage: 'en-US,en;q=0.9,de;q=0.7',
      preferredEngine: 'fetch',
    });
  }

  buildSearchUrl(criteria) {
    const make = criteria.make ? encodeURIComponent(criteria.make.toLowerCase()) : '';
    const model = criteria.model ? encodeURIComponent(criteria.model.toLowerCase().replace(/\s+/g, '-')) : '';
    let path = '/lst';
    if (make) path += `/${make}`;
    if (make && model) path += `/${model}`;
    const params = new URLSearchParams();
    if (criteria.yearMin) params.set('fregfrom', criteria.yearMin);
    if (criteria.yearMax) params.set('fregto', criteria.yearMax);
    if (criteria.mileageMax) params.set('kmto', criteria.mileageMax);
    if (criteria.priceMax) params.set('priceto', criteria.priceMax);
    return `${this.baseUrl}${path}?${params.toString()}`;
  }

  parseHtml(html) {
    const $ = load(html);
    const script = $('#__NEXT_DATA__').html();
    if (script) {
      try {
        const data = JSON.parse(script);
        const ads = extractFromNextData(data);
        if (ads.length) return ads.map(adToRaw);
      } catch { /* fallback */ }
    }
    const raws = [];
    $('article[data-testid="list-item"]').each((_, el) => {
      const r = cardToRaw($(el));
      if (r.id) raws.push(r);
    });
    if (raws.length === 0) throw new Error('no_listings_in_dom');
    return raws;
  }

  async generateMock(criteria) { return generateForSource('autoscout24', criteria); }
  normalize(raw) { return normalizeAutoscout24(raw); }
}

function extractFromNextData(data) {
  const pp = data?.props?.pageProps ?? {};
  const candidates = [pp.listings, pp.initialListings, pp.searchResults?.listings];
  for (const c of candidates) if (Array.isArray(c) && c.length) return c;
  return [];
}

function adToRaw(ad) {
  // Le prix est en string "€ 12,900" dans `price.priceFormatted`, mais la valeur
  // numérique propre est dans `tracking.price` ("12900").
  const trackingPrice = ad.tracking?.price ? parseInt(String(ad.tracking.price).replace(/[^\d]/g, ''), 10) : null;
  const trackingMileage = ad.tracking?.mileage ? parseInt(String(ad.tracking.mileage).replace(/[^\d]/g, ''), 10) : null;
  const firstReg = ad.tracking?.firstRegistration; // "MM-YYYY"
  const firstRegIso = firstReg ? (firstReg.length === 7 ? `${firstReg.slice(3)}-${firstReg.slice(0, 2)}` : firstReg) : null;
  const modelYear = firstReg ? parseInt(firstReg.slice(3), 10) : null;

  // Puissance : dans vehicleDetails["Power"] sous forme "100 kW (136 hp)"
  const powerDetail = ad.vehicleDetails?.find((d) => d.ariaLabel === 'Power');
  const powerMatch = powerDetail?.data?.match(/(\d+)\s*kW\s*\((\d+)\s*hp\)/i);
  const powerKw = powerMatch ? parseInt(powerMatch[1], 10) : null;
  const powerHp = powerMatch ? parseInt(powerMatch[2], 10) : null;

  return {
    id: String(ad.id ?? ad.crossReferenceId),
    brand: ad.vehicle?.make,
    modelName: ad.vehicle?.model,
    version: ad.vehicle?.modelVersionInput ?? null,
    price: { value: trackingPrice, currency: 'EUR', vatDeductible: Boolean(ad.price?.isVatLabelLegallyRequired) },
    mileage: { value: trackingMileage, unit: 'km' },
    firstRegistration: firstRegIso,
    modelYear,
    fuel: ad.vehicle?.fuel, // "Gasoline", "Diesel", "Hybrid", "Electric"
    transmission: ad.vehicle?.transmission, // "Automatic", "Manual"
    power: { hp: powerHp, kw: powerKw },
    body: { type: ad.vehicle?.bodyType ?? null, doors: null, seats: null, color: null },
    location: {
      country: ad.location?.countryCode ?? null,
      region: null,
      city: ad.location?.city ?? null,
    },
    seller: {
      type: ad.seller?.type === 'Dealer' ? 'dealer' : 'private',
      rating: null,
      name: ad.seller?.companyName ?? null,
    },
    equipment: [],
    photos: ad.images ?? [],
    listingUrl: ad.url ? `https://www.autoscout24.com${ad.url}` : null,
    publishedAt: null,
    damageFree: null,
  };
}

function cardToRaw($card) {
  const href = $card.find('a').first().attr('href');
  const text = (sel) => $card.find(sel).first().text().trim();
  return {
    id: href ? href.split('/').pop() : null,
    brand: text('[data-testid="make"]'),
    modelName: text('[data-testid="model"]'),
    version: null,
    price: { value: parseInt(text('[data-testid="price"]').replace(/[^\d]/g, ''), 10) || null, currency: 'EUR' },
    mileage: { value: parseInt(text('[data-testid="mileage"]').replace(/[^\d]/g, ''), 10) || null, unit: 'km' },
    firstRegistration: null,
    modelYear: parseInt(text('[data-testid="first-registration"]'), 10) || null,
    fuel: text('[data-testid="fuel-category"]'),
    transmission: text('[data-testid="transmission"]'),
    power: {}, body: {}, location: {}, seller: {}, equipment: [], photos: [],
    listingUrl: href ? (href.startsWith('http') ? href : `https://www.autoscout24.com${href}`) : null,
    publishedAt: null, damageFree: null,
  };
}
