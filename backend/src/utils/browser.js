// Fetcher navigateur via Playwright.
//
// Rôle : exécuter le JavaScript des pages, passer les challenges Cloudflare /
// DataDome / Akamai, récupérer le HTML hydraté. C'est la voie la plus efficace
// pour scraper sans proxy résidentiel — au prix de ~200 Mo de Chromium.
//
// Activation :
//   1. Ajouter la dep : `npm install playwright`
//   2. Installer Chromium : `npx playwright install chromium`
//   3. Lancer avec `SCRAPER_ENGINE=browser`
//
// En Docker : utiliser l'image `mcr.microsoft.com/playwright:v1.45.0-jammy`
// ou cf. le Dockerfile variant fourni.
//
// Cette intégration est LAZY : playwright n'est importé que si on passe
// vraiment en mode browser, pour ne pas crasher en mode fetch-only.

import { logger } from './logger.js';
import { config } from '../config/index.js';
import { isBlockingPage } from './http.js';

const log = logger.child({ util: 'browser' });

let _pw = null;            // module playwright chargé une fois
let _browser = null;       // instance Chromium singleton
let _loading = null;       // promesse en cours pour éviter les doubles init

async function loadPlaywright() {
  if (_pw) return _pw;
  if (_loading) return _loading;
  _loading = (async () => {
    try {
      // Import dynamique pour ne pas crasher si playwright n'est pas installé.
      _pw = await import('playwright');
      log.info('browser.engine.loaded');
      return _pw;
    } catch (err) {
      log.error('browser.engine.load_failed', { msg: err.message });
      throw new Error('playwright not installed — run `npm install playwright && npx playwright install chromium`');
    } finally {
      _loading = null;
    }
  })();
  return _loading;
}

async function getBrowser() {
  if (_browser) return _browser;
  const pw = await loadPlaywright();
  _browser = await pw.chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // réduit la détection
      '--disable-dev-shm-usage',
    ],
  });
  log.info('browser.launched');
  return _browser;
}

// Fetch une page via Chromium et retourne son HTML final (après JS).
// Options :
//   - waitUntil : 'domcontentloaded' (défaut) | 'networkidle'
//   - timeout : ms
export async function fetchHtmlViaBrowser(url, { waitUntil = 'domcontentloaded', timeout = 20_000, acceptLanguage = 'fr-FR,fr;q=0.9,en;q=0.8' } = {}) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    extraHTTPHeaders: {
      'Accept-Language': acceptLanguage,
    },
  });

  // Patch navigator.webdriver pour réduire les signaux "bot".
  // Cf. puppeteer-extra-plugin-stealth pour une version complète.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en'] });
  });

  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil, timeout });
    // Léger délai pour laisser les XHR finir leur hydration.
    await page.waitForTimeout(800 + Math.random() * 400);
    const html = await page.content();
    if (isBlockingPage(html)) {
      const err = new Error('blocked_by_antibot_browser');
      err.status = 403;
      throw err;
    }
    return html;
  } finally {
    await context.close();
  }
}

// Fermeture propre à l'arrêt du serveur.
export async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch { /* ignore */ }
    _browser = null;
  }
}

export function isBrowserEngineSelected() {
  return (config.scraper.engine || '').toLowerCase() === 'browser';
}
