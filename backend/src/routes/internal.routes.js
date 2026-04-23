import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as internal from '../controllers/internal.controller.js';

export const internalRouter = Router();
internalRouter.get('/status', asyncHandler(internal.status));
internalRouter.post('/scrape', asyncHandler(internal.runBatch));
