import { config } from '../config/index.js';
import { cacheService } from '../services/cache.service.js';
import { getAllMeta } from '../scrapers/registry.js';

export async function health(_req, res) {
  res.json({
    status: 'ok',
    env: config.env,
    scraperMode: config.scraper.mode,
    cache: cacheService.stats(),
    sources: getAllMeta(),
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
