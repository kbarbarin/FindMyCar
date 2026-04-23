import 'dotenv/config';

function num(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  scraper: {
    // mock   : pas de réseau, générateur uniquement
    // live   : réseau uniquement, échoue si la source bloque
    // hybrid : réseau avec fallback mock
    mode: (process.env.SCRAPER_MODE || 'live').toLowerCase(),
    // auto    : chaque scraper utilise son preferredEngine. Auto-escalade fetch → browser.
    // fetch   : force tout en undici (léger, pas de JS exécuté)
    // browser : force tout en Playwright/Chromium (lourd, exécute le JS anti-bot)
    engine: (process.env.SCRAPER_ENGINE || 'auto').toLowerCase(),
    userAgent: process.env.SCRAPER_USER_AGENT || null,
    httpTimeout: num(process.env.HTTP_TIMEOUT, 12000),
    concurrency: num(process.env.SCRAPER_CONCURRENCY, 2),
    warmup: process.env.SCRAPER_WARMUP !== 'false', // true par défaut
  },

  cache: {
    ttlSeconds: num(process.env.CACHE_TTL_SECONDS, 600),
  },

  rateLimit: {
    maxPerMinute: num(process.env.RATE_LIMIT_MAX, 120),
  },
};

export function isModeAllowed(wanted) {
  return config.scraper.mode === wanted;
}
