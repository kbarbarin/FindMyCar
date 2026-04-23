import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { closeBrowser } from './utils/browser.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info('server.listening', { port: config.port, env: config.env, scraperMode: config.scraper.mode });
});

// Arrêt propre pour Docker / Ctrl-C
function shutdown(signal) {
  logger.info('server.shutting_down', { signal });
  server.close(async (err) => {
    try { await closeBrowser(); } catch { /* ignore */ }
    if (err) { logger.error('server.close_failed', { msg: err.message }); process.exit(1); }
    process.exit(0);
  });
  setTimeout(() => { logger.warn('server.force_exit'); process.exit(0); }, 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error('unhandled_rejection', { reason: String(reason) }));
process.on('uncaughtException', (err) => logger.error('uncaught_exception', { msg: err.message }));
