// Handlers d'erreur installés au tout début : capture même les crashs à l'import.
process.on('unhandledRejection', (reason) => {
  console.error('[boot] unhandled_rejection', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[boot] uncaught_exception:', err?.message);
  console.error(err?.stack);
  process.exit(1);
});

console.log('[boot] findmycar-backend starting, Node', process.version, '| PORT =', process.env.PORT || 3000);

import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { closeBrowser } from './utils/browser.js';

console.log('[boot] modules loaded, creating app');

const app = createApp();

console.log('[boot] app created, listening on 0.0.0.0:' + config.port);

const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info('server.listening', { port: config.port, env: config.env, scraperMode: config.scraper.mode });
  console.log('[boot] server.ready');
});

server.on('error', (err) => {
  console.error('[boot] listen_error:', err?.message);
  process.exit(1);
});

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
