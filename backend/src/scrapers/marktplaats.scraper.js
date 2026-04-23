// Marktplaats.nl — Next.js. Payload dans __NEXT_DATA__.

import { load } from 'cheerio';
import { BaseScraper } from './base.scraper.js';
import { normalizeMarktplaats } from '../normalizers/index.js';

export class MarktplaatsScraper extends BaseScraper {
  constructor() {
    super({
      id: 'marktplaats', label: 'Marktplaats', country: 'NL',
      baseUrl: 'https://www.marktplaats.nl',
      acceptLanguage: 'nl-NL,nl;q=0.9,en;q=0.6',
      preferredEngine: 'fetch',
    });
  }

  buildSearchUrl(criteria) {
    const q = [criteria.make, criteria.model].filter(Boolean).join(' ');
    // Catégorie 91 = "Auto's" sur Marktplaats.
    const params = new URLSearchParams({ categoryId: '91' });
    if (q) params.set('query', q);
    if (criteria.priceMax) params.set('priceTo', String(criteria.priceMax));
    if (criteria.yearMin) params.set('attributeRanges[]', `constructionYear:${criteria.yearMin}:2030`);
    return `${this.baseUrl}/lrp/api/search?${params.toString()}`;
  }

  async searchLive(criteria) {
    // Marktplaats expose une API JSON interne, plus stable que le HTML rendu.
    // On court-circuite fetchHtml → on parle JSON directement.
    const url = this.buildSearchUrl(criteria);
    this.log.info('scrape.search', { url, engine: 'fetch' });
    if (!this.session.warmedUp) await this.session.warmup();
    const body = await this.session.get(url, { referer: this.baseUrl, expectHtml: false });
    let data;
    try { data = JSON.parse(body); }
    catch { throw new Error('json_parse_failed'); }
    const listings = data?.listings || [];
    if (!listings.length) throw new Error('no_listings_in_api');
    return listings.map(adToRaw);
  }

  parseHtml(html) {
    const $ = load(html);
    const script = $('#__NEXT_DATA__').html();
    if (script) {
      try {
        const data = JSON.parse(script);
        const listings = findListings(data);
        if (listings.length) return listings.map(adToRaw);
      } catch { /* fallback below */ }
    }
    const raws = [];
    $('li.hz-Listing, article[data-testid="listing"]').each((_, el) => {
      const card = $(el);
      const href = card.find('a').first().attr('href');
      if (!href) return;
      raws.push({
        id: href.split('/').pop() || Math.random().toString(36).slice(2),
        title: card.find('h3, .hz-Listing-title').first().text().trim(),
        price: parseInt(card.find('.hz-Listing-price').first().text().replace(/[^\d]/g, ''), 10) || null,
        mileage: card.find('.hz-Attribute--mileage, [data-testid="mileage"]').first().text(),
        year: parseInt(card.find('.hz-Attribute--year').first().text(), 10) || null,
        fuel: card.find('.hz-Attribute--fuel').first().text().trim() || null,
        transmission: card.find('.hz-Attribute--transmission').first().text().trim() || null,
        city: card.find('.hz-Listing-location').first().text().trim() || null,
        photos: card.find('img').map((_, img) => $(img).attr('src')).get().filter(Boolean),
        url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
        seller: 'private',
      });
    });
    if (raws.length === 0) throw new Error('no_ads_found');
    return raws;
  }

  normalize(raw) { return normalizeMarktplaats(raw); }
}

function findListings(data) {
  const pp = data?.props?.pageProps ?? {};
  const candidates = [pp.searchRequestAndResponse?.listings, pp.listings, pp.initialListings];
  for (const c of candidates) if (Array.isArray(c) && c.length) return c;
  return [];
}

function adToRaw(ad) {
  const attrs = {};
  for (const a of (ad.extendedAttributes || ad.attributes || [])) {
    if (a.key) attrs[a.key.toLowerCase()] = a.value;
  }
  return {
    id: String(ad.itemId || ad.id),
    title: ad.title,
    make: attrs.make || null,
    model: attrs.model || null,
    price: ad.priceInfo?.priceCents ? Math.round(ad.priceInfo.priceCents / 100) : (ad.price || null),
    mileage: attrs.mileage || attrs.km || null,
    year: parseInt(attrs['construction-year'] || attrs.year || '0', 10) || null,
    fuel: attrs.fuel || null,
    transmission: attrs.transmission || null,
    city: ad.location?.cityName || null,
    photos: (ad.imageUrls || ad.pictures || []).map((p) => p.mediumUrl || p.url || p).filter(Boolean),
    url: ad.vip ? `https://www.marktplaats.nl${ad.vip}` : null,
    seller: ad.sellerInformation?.sellerType || 'private',
    sellerName: ad.sellerInformation?.sellerName || null,
    postedAt: ad.date || null,
  };
}
