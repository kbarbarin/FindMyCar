// Client HTTP réaliste pour le scraping sans proxy.
//
// Stratégie anti-détection (best-effort, ne trompe pas DataDome/Cloudflare avancé) :
//   1. Headers qui matchent ceux d'un Chrome récent (sec-ch-ua, fetch metadata, etc.)
//   2. Pool de User-Agent : on roule sur plusieurs UAs pour éviter le fingerprint statique
//   3. Jar de cookies par session → suit les redirections avec Set-Cookie (ex: le
//      cookie de conformité RGPD, le token de session, etc.)
//   4. Warm-up : avant de lancer une recherche, on visite la home page pour récupérer
//      les cookies initiaux (Cloudflare en pose souvent un "cf_clearance")
//   5. Jitter + délai minimal entre requêtes par host
//
// Pour la V2, quand tu auras un budget : brancher un proxy via undici.ProxyAgent,
// le reste du code ne change pas.

import { fetch, Agent } from 'undici';
import { config } from '../config/index.js';
import { logger } from './logger.js';

const log = logger.child({ util: 'http' });

// Pool d'User-Agents Chrome récents (desktop + mobile). On tire au hasard.
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Headers qui ressemblent à ceux d'un Chrome desktop qui visite une page.
// Chaque scraper peut overrider Accept-Language si c'est un site régional.
function chromeHeaders(ua) {
  const isMac = /Macintosh/.test(ua);
  const platform = isMac ? '"macOS"' : /Windows/.test(ua) ? '"Windows"' : '"Linux"';
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': platform,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Dnt': '1',
  };
}

// Détecte les pages d'anti-bot les plus courantes.
export function isBlockingPage(html) {
  if (!html) return true;
  const s = html.slice(0, 6000).toLowerCase();
  return (
    s.includes('datadome') ||
    s.includes('_dd_') ||
    s.includes('captcha') ||
    (s.includes('cloudflare') && (s.includes('challenge') || s.includes('just a moment'))) ||
    s.includes('please enable javascript') ||
    s.includes('access denied') ||
    s.includes('you have been blocked') ||
    s.length < 800
  );
}

// Un Agent undici partagé : HTTP keep-alive, timeouts cohérents, TLS par défaut.
// Note : undici ne permet pas le TLS fingerprinting complet de Chrome. Pour ça il
// faudrait `curl-impersonate` (C binary). Ici on vise le meilleur rapport effort/résultat.
const sharedAgent = new Agent({
  connect: { timeout: 10_000, rejectUnauthorized: true },
  keepAliveTimeout: 30_000,
  pipelining: 1,
});

export async function rawGet(url, { headers = {}, timeout = config.scraper.httpTimeout } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error('timeout')), timeout);
  try {
    return await fetch(url, { headers, signal: ctrl.signal, dispatcher: sharedAgent });
  } finally {
    clearTimeout(t);
  }
}

// --- Session : jar de cookies + warm-up -----------------------------------
// Une ScrapingSession = une "visite" d'un site, avec ses cookies et son UA fixe.
// On en instancie une par scraper (sinon les cookies fuitent entre sources).

export class ScrapingSession {
  constructor({ baseUrl, acceptLanguage } = {}) {
    this.baseUrl = baseUrl;
    this.ua = pickUserAgent();
    this.cookies = new Map(); // name → value
    this.lastRequestAt = 0;
    this.warmedUp = false;
    this.acceptLanguage = acceptLanguage;
  }

  cookieHeader() {
    if (this.cookies.size === 0) return null;
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  ingestCookies(setCookieHeaders) {
    if (!setCookieHeaders) return;
    const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const raw of arr) {
      const [pair] = String(raw).split(';');
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  async throttle() {
    // Min 500 ms + jitter [0-600ms] entre requêtes par session.
    const now = Date.now();
    const minGap = 500 + Math.random() * 600;
    const wait = Math.max(0, this.lastRequestAt + minGap - now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  headers(extra = {}, { referer } = {}) {
    const base = chromeHeaders(this.ua);
    if (this.acceptLanguage) base['Accept-Language'] = this.acceptLanguage;
    if (referer) {
      base['Referer'] = referer;
      base['Sec-Fetch-Site'] = 'same-origin';
    }
    const cookie = this.cookieHeader();
    if (cookie) base['Cookie'] = cookie;
    return { ...base, ...extra };
  }

  async get(url, { referer, expectHtml = true } = {}) {
    await this.throttle();
    const res = await rawGet(url, { headers: this.headers({}, { referer }) });
    // Collecte les Set-Cookie
    const setCookie = res.headers.getSetCookie?.() ?? res.headers.get('set-cookie');
    this.ingestCookies(setCookie);

    if (!res.ok) {
      const snippet = await res.text().catch(() => '');
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.snippet = snippet.slice(0, 240);
      throw err;
    }
    const body = await res.text();
    if (expectHtml && isBlockingPage(body)) {
      const err = new Error('blocked_by_antibot');
      err.status = 403;
      err.snippet = body.slice(0, 240);
      throw err;
    }
    return body;
  }

  // Visite la home page pour récupérer les cookies initiaux.
  // C'est ce que fait Chrome naturellement : tu arrives sur une page interne
  // directement depuis Google, tu as d'abord "acheté" les cookies en passant par la home.
  async warmup() {
    if (this.warmedUp || !this.baseUrl) return;
    try {
      log.debug('session.warmup', { host: new URL(this.baseUrl).host });
      await this.get(this.baseUrl);
      this.warmedUp = true;
    } catch (err) {
      log.warn('session.warmup.failed', { host: new URL(this.baseUrl).host, msg: err.message });
      // On n'échoue pas fort : le warmup est best-effort.
    }
  }
}
