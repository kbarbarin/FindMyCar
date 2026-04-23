// Auto24.ee — site estonien, HTML server-rendered ancienne école, relativement
// permissif.

import { load } from 'cheerio';
import { BaseScraper } from './base.scraper.js';
import { normalizeAuto24 } from '../normalizers/index.js';

export class Auto24Scraper extends BaseScraper {
  constructor() {
    super({
      id: 'auto24', label: 'Auto24', country: 'EE',
      baseUrl: 'https://www.auto24.ee',
      acceptLanguage: 'et-EE,et;q=0.9,en;q=0.6',
      preferredEngine: 'fetch',
    });
  }

  buildSearchUrl(criteria) {
    const q = [criteria.make, criteria.model].filter(Boolean).join(' ');
    const params = new URLSearchParams();
    if (q) params.set('otsingSona', q);
    if (criteria.priceMax) params.set('aMax', criteria.priceMax);
    if (criteria.yearMin) params.set('aastaMin', criteria.yearMin);
    if (criteria.mileageMax) params.set('lMax', criteria.mileageMax);
    const qs = params.toString();
    return `${this.baseUrl}/kasutatud/nimekiri.php${qs ? `?${qs}` : ''}`;
  }

  parseHtml(html) {
    const $ = load(html);
    const raws = [];
    // Auto24 utilise des <tr> ou <div.result-row> pour ses résultats
    $('tr.result-row, div.result-row, article.search-result, .result-item').each((_, el) => {
      const row = $(el);
      const href = row.find('a').first().attr('href');
      if (!href) return;
      const title = (row.find('.result-title, h3, a').first().text() || '').trim();
      const priceText = row.find('.result-price, .price').first().text();
      const kmText = row.find('.result-mileage, .mileage').first().text();
      const yearText = row.find('.result-year, .year').first().text();
      const fuel = row.find('.result-fuel, .fuel').first().text().trim() || null;
      const transmission = row.find('.result-transmission').first().text().trim() || null;
      const city = row.find('.result-location, .location').first().text().trim() || null;
      const [make, model] = extractMakeModelFromTitle(title);
      raws.push({
        id: href.split(/[=\/]/).pop() || Math.random().toString(36).slice(2),
        title,
        make, model,
        price: parseInt(priceText.replace(/[^\d]/g, ''), 10) || null,
        mileage: kmText,
        year: parseInt(yearText, 10) || null,
        fuel, transmission,
        powerHp: null,
        city,
        seller: /edas|dealer/i.test(row.find('.seller-type').text()) ? 'dealer' : 'private',
        photos: row.find('img').map((_, img) => $(img).attr('src')).get().filter(Boolean),
        url: href.startsWith('http') ? href : `${this.baseUrl}${href.startsWith('/') ? '' : '/'}${href}`,
      });
    });
    if (raws.length === 0) throw new Error('no_ads_found');
    return raws;
  }

  normalize(raw) { return normalizeAuto24(raw); }
}

const KNOWN_MAKES = ['Toyota','Peugeot','Renault','Volvo','BMW','Volkswagen','VW','Skoda','Tesla','Citroën','Citroen','Audi','Mercedes','Kia','Hyundai','Ford','Dacia','Nissan','Opel','Fiat','SEAT'];
function extractMakeModelFromTitle(title) {
  if (!title) return [null, null];
  const lower = title.toLowerCase();
  for (const m of KNOWN_MAKES) {
    if (lower.startsWith(m.toLowerCase())) {
      const rest = title.slice(m.length).trim();
      return [m === 'VW' ? 'Volkswagen' : m === 'Citroen' ? 'Citroën' : m, rest.split(/\s+/)[0] || null];
    }
  }
  return [null, null];
}
