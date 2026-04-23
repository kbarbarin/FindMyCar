// Classe de base d'un scraper.
//
// Fonctionnement :
//   1. Chaque scraper déclare son preferredEngine ('fetch' ou 'browser').
//   2. Le flag global SCRAPER_ENGINE peut forcer tout le monde sur un engine.
//   3. Quand une requête fetch se prend un 403 (anti-bot), on ESCALATE
//      automatiquement en browser, si playwright est installé.
//   4. En mode 'live' un échec terminal propage l'erreur. En 'hybrid' on
//      fallback sur le générateur mock. 'mock' = pas de réseau.
//
// Les sous-classes implémentent :
//   - buildSearchUrl(criteria) → string
//   - parseHtml(html, criteria) → RawListing[]
//   - generateMock(criteria) → RawListing[]
//   - normalize(raw) → NormalizedListing

import PQueue from 'p-queue';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ScrapingSession } from '../utils/http.js';
import { fetchHtmlViaBrowser } from '../utils/browser.js';

export class BaseScraper {
  constructor({ id, label, country, baseUrl, acceptLanguage, preferredEngine = 'fetch' }) {
    this.id = id;
    this.label = label;
    this.country = country;
    this.baseUrl = baseUrl;
    this.enabled = true;
    this.preferredEngine = preferredEngine;
    this.log = logger.child({ scraper: id });
    this.queue = new PQueue({ concurrency: config.scraper.concurrency });
    this.session = new ScrapingSession({ baseUrl, acceptLanguage });
  }

  // --- À implémenter ---
  buildSearchUrl(/* criteria */)     { throw new Error(`${this.id}: buildSearchUrl not implemented`); }
  parseHtml(/* html, criteria */)    { throw new Error(`${this.id}: parseHtml not implemented`); }
  async generateMock(/* criteria */) { throw new Error(`${this.id}: generateMock not implemented`); }
  normalize(/* raw */)               { throw new Error(`${this.id}: normalize not implemented`); }

  // --- Résolution de l'engine actif ---
  resolveEngine() {
    const forced = (config.scraper.engine || 'auto').toLowerCase();
    if (forced === 'fetch' || forced === 'browser') return forced;
    // 'auto' (défaut) : chaque scraper utilise son engine préféré.
    return this.preferredEngine;
  }

  // --- Entrée publique ---
  async search(criteria) {
    const mode = config.scraper.mode;
    if (mode === 'mock') return { items: await this.generateMock(criteria), source: 'mock' };

    try {
      const items = await this.queue.add(() => this.searchLive(criteria));
      if (!items || items.length === 0) throw new Error('empty_results');
      return { items, source: 'live' };
    } catch (err) {
      this.log.warn('scrape.failed', {
        msg: err.message, status: err.status, snippet: err.snippet?.slice(0, 120),
      });
      if (mode === 'live') throw err;
      // hybrid : fallback sur le générateur
      const items = await this.generateMock(criteria);
      return { items, source: 'fallback_mock', error: err.message };
    }
  }

  async searchLive(criteria) {
    const url = this.buildSearchUrl(criteria);
    let engine = this.resolveEngine();
    this.log.info('scrape.search', { url, engine });
    try {
      const html = await this.fetchHtml(url, engine);
      return this.parseHtml(html, criteria);
    } catch (err) {
      // Auto-escalade : si fetch est bloqué par anti-bot, on retente en browser.
      const shouldEscalate = engine === 'fetch' && (
        err.status === 403 || err.message === 'blocked_by_antibot' || err.message === 'HTTP 403'
      );
      if (!shouldEscalate) throw err;
      this.log.info('scrape.escalate_to_browser', { url });
      try {
        const html = await this.fetchHtml(url, 'browser');
        return this.parseHtml(html, criteria);
      } catch (err2) {
        this.log.warn('scrape.browser_failed', { msg: err2.message, status: err2.status });
        throw err2;
      }
    }
  }

  async fetchHtml(url, engine) {
    if (engine === 'browser') {
      return fetchHtmlViaBrowser(url, { acceptLanguage: this.session.acceptLanguage });
    }
    if (config.scraper.warmup && !this.session.warmedUp) {
      await this.session.warmup();
    }
    return this.session.get(url, { referer: this.baseUrl });
  }
}
