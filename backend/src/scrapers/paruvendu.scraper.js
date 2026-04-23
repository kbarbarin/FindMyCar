// ParuVendu — site FR historiquement moins protégé que Leboncoin/LaCentrale.
// HTML server-rendered, parsing direct via cheerio.

import { load } from 'cheerio';
import { BaseScraper } from './base.scraper.js';
import { normalizeParuVendu } from '../normalizers/index.js';

export class ParuVenduScraper extends BaseScraper {
  constructor() {
    super({
      id: 'paruvendu', label: 'ParuVendu', country: 'FR',
      baseUrl: 'https://www.paruvendu.fr',
      acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8',
      preferredEngine: 'fetch',
    });
  }

  buildSearchUrl(criteria) {
    const q = [criteria.make, criteria.model].filter(Boolean).join(' ');
    const params = new URLSearchParams();
    if (q) params.set('p', q);
    if (criteria.priceMax) params.set('prixmax', criteria.priceMax);
    if (criteria.yearMin) params.set('anneemin', criteria.yearMin);
    if (criteria.mileageMax) params.set('kmmax', criteria.mileageMax);
    const qs = params.toString();
    return `${this.baseUrl}/a/voiture-occasion${qs ? `/?${qs}` : ''}`;
  }

  parseHtml(html) {
    const $ = load(html);
    const raws = [];
    // Chaque annonce est un <article> ou <li> avec un id/data-id. Les sélecteurs
    // exacts changent avec les refontes : plusieurs heuristiques pour résister.
    $('article.annonce, article.listing, li.annonce, div[data-classified-id]').each((_, el) => {
      const card = $(el);
      const id = card.attr('data-classified-id') || card.attr('data-id') || card.find('a').first().attr('href');
      if (!id) return;
      const title = (card.find('h3, h2, .title, a[data-testid="title"]').first().text() || '').trim();
      const priceText = card.find('.prix, .price, [data-testid="price"]').first().text();
      const kmText = card.find('.km, [data-testid="mileage"]').first().text();
      const yearText = card.find('.annee, [data-testid="year"]').first().text();
      const href = card.find('a').first().attr('href');
      raws.push({
        id: String(id).replace(/[^\w-]/g, '').slice(0, 40) || Math.random().toString(36).slice(2),
        titre: title,
        prix: parsePrice(priceText),
        km: kmText,
        annee: parseInt(yearText.replace(/[^\d]/g, ''), 10) || null,
        carburant: card.find('.carburant, [data-testid="fuel"]').first().text().trim() || null,
        boite: card.find('.boite, [data-testid="gearbox"]').first().text().trim() || null,
        puissance: null,
        ville: card.find('.ville, .location, [data-testid="location"]').first().text().trim() || null,
        vendeur: /pro/i.test(card.find('.vendeur, .seller-type').first().text()) ? 'dealer' : 'private',
        photos: card.find('img').map((i, img) => $(img).attr('data-src') || $(img).attr('src')).get().filter(Boolean),
        url: href ? (href.startsWith('http') ? href : `${this.baseUrl}${href}`) : null,
        publie_le: null,
      });
    });

    if (raws.length === 0) throw new Error('no_ads_found');
    return raws;
  }

  normalize(raw) { return normalizeParuVendu(raw); }
}

function parsePrice(s) {
  if (!s) return null;
  const n = parseInt(String(s).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n >= 500 ? n : null;
}
