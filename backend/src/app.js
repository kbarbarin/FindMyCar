import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import { routes } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRateLimit } from './middleware/rateLimit.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()),
    credentials: false,
  }));
  app.use(express.json({ limit: '256kb' }));
  if (config.env !== 'test') {
    app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
  }
  app.use('/api', apiRateLimit, routes);

  app.get('/', (_req, res) => res.json({ name: 'findmycar-backend', version: '0.2.0', docs: '/api/health' }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
