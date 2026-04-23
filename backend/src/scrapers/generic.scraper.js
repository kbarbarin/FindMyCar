// GenericScraper : un scraper qui s'adapte à la source via une config déclarative
// dans le catalogue. Il essaie plusieurs stratégies d'extraction dans l'ordre :
//
//   1. json-ld      : parse les <script type="application/ld+json"> (schema.org/Car,
//                     Vehicle, ItemList, Offer, Product). Beaucoup de marketplaces
//                     injectent ça pour le SEO → c'est souvent le moyen le plus
//                     robuste, résistant aux refontes HTML.
//   2. next-data    : parse <script id="__NEXT_DATA__"> (sites Next.js).
//   3. nuxt-data    : parse <script id="__NUXT_DATA__"> (sites Nuxt).
//   4. initial-state: parse <script id="__INITIAL_STATE__"> (divers frameworks).
//   5. selectors    : parsing cheerio avec un config { cards, title, price, ... }.
//
// La config de chaque source vit dans sources.catalog.js dans `generic`.
// Si aucune stratégie ne produit d'annonces, le scraper échoue proprement et
// apparaît "error" dans sourceStats — pas de plantage global.

import { load } from 'cheerio';
import { BaseScraper } from './base.scraper.js';
import { emptyListing, makeListingId } from '../models/listing.model.js';
import {
  normalizeFuel, normalizeTransmission, normalizeMake, normalizeModel,
  parseMileage, yearFromAny, parseFirstRegistration,
} from '../normalizers/taxonomy.js';

const DEFAULT_STRATEGIES = ['json-ld', 'next-data', 'nuxt-data', 'initial-state', 'selectors'];

export class GenericScraper extends BaseScraper {
  constructor(catalogEntry) {
    super({
      id: catalogEntry.id,
      label: catalogEntry.label,
      country: catalogEntry.country,
      baseUrl: catalogEntry.baseUrl,
      acceptLanguage: catalogEntry.acceptLanguage || defaultAcceptLanguage(catalogEntry.country),
      preferredEngine: catalogEntry.preferredEngine || 'fetch',
    });
    this.catalogEntry = catalogEntry;
    this.cfg = catalogEntry.generic || {};
  }

  buildSearchUrl(criteria) {
    return this.catalogEntry.searchUrl?.(criteria ?? {}) ?? this.baseUrl;
  }

  parseHtml(html) {
    const strategies = this.cfg.strategies || DEFAULT_STRATEGIES;
    const errors = [];
    for (const s of strategies) {
      try {
        const raws = runStrategy(s, html, this.cfg, this.baseUrl);
        if (raws && raws.length) return raws;
      } catch (err) {
        errors.push(`${s}: ${err.message}`);
      }
    }
    throw new Error(`all_strategies_failed: ${errors.slice(0, 3).join(' | ')}`);
  }

  async generateMock() { return []; }

  normalize(raw) {
    // Normalisation commune : les stratégies produisent toutes un RawListing uniforme.
    const firstReg = raw.firstRegistration ? parseFirstRegistration(raw.firstRegistration) : null;
    const year = yearFromAny({ year: raw.year, firstRegistration: firstReg });
    return emptyListing({
      id: makeListingId(this.id, String(raw.id || raw.url || Math.random().toString(36).slice(2))),
      source: { id: this.id, label: this.label, country: this.country },
      url: raw.url ?? null,
      title: raw.title ?? null,
      make: normalizeMake(raw.make),
      model: normalizeModel(raw.model),
      version: raw.version ?? null,
      year,
      firstRegistration: firstReg,
      mileageKm: parseMileage(raw.mileage),
      price: {
        amount: raw.price ?? null,
        currency: raw.currency || this.cfg.currency || 'EUR',
      },
      fuel: normalizeFuel(raw.fuel),
      transmission: normalizeTransmission(raw.transmission),
      powerHp: raw.powerHp ?? null,
      powerKw: raw.powerHp ? Math.round(raw.powerHp * 0.7355) : (raw.powerKw ?? null),
      doors: raw.doors ?? null,
      seats: raw.seats ?? null,
      color: raw.color ?? null,
      country: this.country,
      region: raw.region ?? null,
      city: raw.city ?? null,
      seller: { type: raw.seller || null, name: raw.sellerName || null, rating: null },
      features: raw.features ?? [],
      history: { firstHand: null, accidentFree: null, serviceBookComplete: null },
      photos: raw.photos ?? [],
      postedAt: raw.postedAt ?? null,
      meta: { normalizedAt: new Date().toISOString(), reconstructed: [], fieldsMissing: [] },
    });
  }
}

// --- Stratégies d'extraction --------------------------------------------

function runStrategy(strategy, html, cfg, baseUrl) {
  switch (strategy) {
    case 'json-ld':        return extractJsonLd(html, baseUrl);
    case 'next-data':      return extractScriptJson(html, '__NEXT_DATA__', cfg, baseUrl);
    case 'nuxt-data':      return extractScriptJson(html, '__NUXT_DATA__', cfg, baseUrl);
    case 'initial-state':  return extractScriptJson(html, '__INITIAL_STATE__', cfg, baseUrl);
    case 'selectors':      return extractWithSelectors(html, cfg, baseUrl);
    default: throw new Error(`unknown_strategy:${strategy}`);
  }
}

// Stratégie 1 : JSON-LD. Cherche les balises <script type="application/ld+json">
// et sélectionne tout ce qui ressemble à un véhicule (schema.org/Car, Vehicle,
// Product, Offer, ItemList).
function extractJsonLd(html, baseUrl) {
  const $ = load(html);
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).contents().text();
    try { blocks.push(JSON.parse(txt)); } catch { /* skip invalid blocks */ }
  });
  const raws = [];
  for (const block of blocks) flattenLd(block, raws, baseUrl);
  if (raws.length === 0) throw new Error('no_json_ld');
  return raws;
}

function flattenLd(node, out, baseUrl) {
  if (!node) return;
  if (Array.isArray(node)) { for (const n of node) flattenLd(n, out, baseUrl); return; }
  if (typeof node !== 'object') return;

  const type = String(node['@type'] || '').toLowerCase();

  // ItemList → récursif sur itemListElement
  if (type === 'itemlist' && Array.isArray(node.itemListElement)) {
    for (const item of node.itemListElement) flattenLd(item.item || item, out, baseUrl);
    return;
  }

  if (type === 'car' || type === 'vehicle' || type === 'product' || node.vehicleEngine || node.vehicleTransmission) {
    out.push(ldCarToRaw(node, baseUrl));
    return;
  }

  // Parfois les annonces sont dans `item.offers[]` ou `offers`
  if (node.offers) flattenLd(node.offers, out, baseUrl);
  if (Array.isArray(node.itemOffered)) { for (const n of node.itemOffered) flattenLd(n, out, baseUrl); }
}

function ldCarToRaw(c, baseUrl) {
  const priceObj = (Array.isArray(c.offers) ? c.offers[0] : c.offers) || c;
  const price = parseLdNumber(priceObj?.price ?? priceObj?.priceSpecification?.price);
  const mileage = c.mileageFromOdometer?.value || c.mileageFromOdometer;
  const year = parseInt(c.productionDate || c.modelDate || c.vehicleModelDate || '0', 10) || null;
  return {
    id: c['@id'] || c.sku || c.productID || c.url,
    title: c.name,
    make: c.brand?.name || c.brand || c.manufacturer?.name,
    model: c.model?.name || c.model,
    version: c.vehicleConfiguration || null,
    year,
    firstRegistration: c.dateVehicleFirstRegistered || null,
    mileage,
    price,
    currency: priceObj?.priceCurrency || 'EUR',
    fuel: c.fuelType,
    transmission: c.vehicleTransmission,
    powerHp: parseLdNumber(c.vehicleEnginePower || c.enginePower),
    doors: parseInt(c.numberOfDoors, 10) || null,
    seats: parseInt(c.numberOfSeats, 10) || null,
    color: c.color,
    city: c.offers?.availableAtOrFrom?.address?.addressLocality || null,
    photos: toArray(c.image).map(imgUrl).filter(Boolean),
    url: absoluteUrl(c.url || c['@id'], baseUrl),
    postedAt: null,
  };
}

// Stratégie 2/3/4 : extrait un payload JSON d'une balise script par id
function extractScriptJson(html, scriptId, cfg, baseUrl) {
  const $ = load(html);
  const txt = $(`#${scriptId}`).html();
  if (!txt) throw new Error(`no_${scriptId}_tag`);
  let data;
  try { data = JSON.parse(txt); }
  catch { throw new Error(`${scriptId}_parse_error`); }

  // On scanne récursivement pour trouver un tableau d'annonces.
  // Le path peut être donné en config, sinon auto-détection.
  if (cfg.adsPath) {
    const ads = pathGet(data, cfg.adsPath);
    if (Array.isArray(ads) && ads.length) return ads.map((ad) => genericAdToRaw(ad, cfg, baseUrl));
  }
  const ads = findAdArray(data);
  if (!ads.length) throw new Error(`no_ads_in_${scriptId}`);
  return ads.map((ad) => genericAdToRaw(ad, cfg, baseUrl));
}

function findAdArray(data) {
  // Heuristique : on cherche un tableau d'objets qui contient "price" ou "priceFormatted"
  // ou "vehicle" ou "make".
  const found = [];
  const seen = new WeakSet();
  (function walk(node, depth) {
    if (!node || typeof node !== 'object' || depth > 12 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      if (node.length >= 3 && typeof node[0] === 'object' && node[0] && (
        'price' in node[0] || 'vehicle' in node[0] || 'make' in node[0] ||
        'priceFormatted' in node[0] || 'modelName' in node[0] || 'titre' in node[0]
      )) {
        found.push(node);
        return;
      }
      for (const n of node) walk(n, depth + 1);
      return;
    }
    for (const v of Object.values(node)) walk(v, depth + 1);
  })(data, 0);
  // On prend le plus gros tableau trouvé.
  return found.sort((a, b) => b.length - a.length)[0] ?? [];
}

function genericAdToRaw(ad, cfg, baseUrl) {
  const get = (path) => path ? pathGet(ad, path) : null;
  const priceRaw = get(cfg.fields?.price) ?? ad.price?.value ?? ad.price?.amount ?? ad.tracking?.price ?? ad.price;
  const mileageRaw = get(cfg.fields?.mileage) ?? ad.mileage?.value ?? ad.tracking?.mileage ?? ad.mileage;
  return {
    id: get(cfg.fields?.id) ?? ad.id ?? ad.urn ?? ad.identifier,
    title: get(cfg.fields?.title) ?? ad.title ?? ad.subject ?? ad.name,
    make: get(cfg.fields?.make) ?? ad.make ?? ad.brand ?? ad.vehicle?.make,
    model: get(cfg.fields?.model) ?? ad.model ?? ad.vehicle?.model,
    version: get(cfg.fields?.version) ?? ad.version ?? ad.vehicle?.modelVersionInput,
    year: parseInt(get(cfg.fields?.year) ?? ad.year ?? ad.modelYear ?? '0', 10) || null,
    firstRegistration: get(cfg.fields?.firstRegistration) ?? ad.firstRegistration ?? null,
    mileage: mileageRaw,
    price: parseLdNumber(priceRaw),
    currency: get(cfg.fields?.currency) ?? ad.price?.currency ?? 'EUR',
    fuel: get(cfg.fields?.fuel) ?? ad.fuel ?? ad.vehicle?.fuel,
    transmission: get(cfg.fields?.transmission) ?? ad.transmission ?? ad.vehicle?.transmission,
    powerHp: parseInt(get(cfg.fields?.powerHp) ?? '0', 10) || null,
    city: get(cfg.fields?.city) ?? ad.location?.city ?? ad.city,
    region: get(cfg.fields?.region) ?? ad.location?.region,
    photos: toArray(get(cfg.fields?.photos) ?? ad.photos ?? ad.images).map(imgUrl).filter(Boolean),
    url: absoluteUrl(get(cfg.fields?.url) ?? ad.url ?? ad.listingUrl ?? ad.vip, baseUrl),
    seller: ad.seller?.type || ad.sellerType || null,
    postedAt: ad.postedAt ?? ad.publishedAt ?? ad.creationDate ?? null,
  };
}

// Stratégie 5 : sélecteurs cheerio
function extractWithSelectors(html, cfg, baseUrl) {
  const sel = cfg.selectors;
  if (!sel || !sel.cards) throw new Error('no_selectors_config');
  const $ = load(html);
  const raws = [];
  $(sel.cards).each((_, el) => {
    const card = $(el);
    const text = (s) => s ? card.find(s).first().text().trim() : '';
    const href = sel.link ? card.find(sel.link).first().attr('href') : card.find('a').first().attr('href');
    const photos = (sel.photo ? card.find(sel.photo) : card.find('img'))
      .map((_, img) => $(img).attr('data-src') || $(img).attr('src')).get().filter(Boolean);
    raws.push({
      id: href ? href.split(/[\/#?]/).pop() : Math.random().toString(36).slice(2),
      title: text(sel.title),
      make: sel.make ? text(sel.make) : null,
      model: sel.model ? text(sel.model) : null,
      price: parseInt(text(sel.price).replace(/[^\d]/g, ''), 10) || null,
      mileage: text(sel.mileage),
      year: parseInt(text(sel.year), 10) || null,
      fuel: text(sel.fuel) || null,
      transmission: text(sel.transmission) || null,
      city: text(sel.city) || null,
      photos,
      url: absoluteUrl(href, baseUrl),
      seller: null,
    });
  });
  if (raws.length === 0) throw new Error('no_cards_matched_selectors');
  return raws;
}

// --- Utils --------------------------------------------------------------

function pathGet(obj, path) {
  if (!path) return null;
  let v = obj;
  for (const key of String(path).split('.')) {
    if (v == null) return null;
    v = v[key];
  }
  return v ?? null;
}

function parseLdNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Math.round(v);
  const n = parseInt(String(v).replace(/[^\d.]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function imgUrl(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  return v.url || v.contentUrl || v.src || null;
}

function absoluteUrl(href, baseUrl) {
  if (!href) return null;
  if (/^https?:\/\//.test(href)) return href;
  if (href.startsWith('//')) return `https:${href}`;
  return `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
}

function defaultAcceptLanguage(country) {
  return ({
    FR: 'fr-FR,fr;q=0.9,en;q=0.8',
    DE: 'de-DE,de;q=0.9,en;q=0.7',
    ES: 'es-ES,es;q=0.9,en;q=0.7',
    IT: 'it-IT,it;q=0.9,en;q=0.7',
    PT: 'pt-PT,pt;q=0.9,en;q=0.7',
    NL: 'nl-NL,nl;q=0.9,en;q=0.7',
    PL: 'pl-PL,pl;q=0.9,en;q=0.7',
    SE: 'sv-SE,sv;q=0.9,en;q=0.7',
    NO: 'nb-NO,nb;q=0.9,en;q=0.7',
    FI: 'fi-FI,fi;q=0.9,en;q=0.7',
    DK: 'da-DK,da;q=0.9,en;q=0.7',
    RO: 'ro-RO,ro;q=0.9,en;q=0.7',
    BG: 'bg-BG,bg;q=0.9,en;q=0.7',
    GR: 'el-GR,el;q=0.9,en;q=0.7',
    LT: 'lt-LT,lt;q=0.9,en;q=0.7',
    LV: 'lv-LV,lv;q=0.9,en;q=0.7',
    EE: 'et-EE,et;q=0.9,en;q=0.7',
    HU: 'hu-HU,hu;q=0.9,en;q=0.7',
    CH: 'fr-CH,fr;q=0.9,de-CH;q=0.8,en;q=0.7',
    BE: 'fr-BE,fr;q=0.9,nl-BE;q=0.8,en;q=0.7',
    LU: 'fr-LU,fr;q=0.9,de-LU;q=0.8,en;q=0.7',
  })[country] || 'en-US,en;q=0.9';
}
