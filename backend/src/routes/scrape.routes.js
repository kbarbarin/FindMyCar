import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { deepScrapeStream } from '../controllers/deepScrape.controller.js';

export const scrapeRouter = Router();
scrapeRouter.get('/deep/stream', asyncHandler(deepScrapeStream));
