import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { sourcesRouter } from './sources.routes.js';
import { searchRouter } from './search.routes.js';
import { listingsRouter } from './listings.routes.js';
import { estimateRouter } from './estimate.routes.js';
import { statsRouter } from './stats.routes.js';
import { internalRouter } from './internal.routes.js';

export const routes = Router();

routes.use('/health', healthRouter);
routes.use('/sources', sourcesRouter);
routes.use('/search', searchRouter);
routes.use('/listings', listingsRouter);
routes.use('/estimate', estimateRouter);
routes.use('/stats', statsRouter);
routes.use('/internal', internalRouter);
