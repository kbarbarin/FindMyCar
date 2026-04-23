import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as stats from '../controllers/stats.controller.js';

export const statsRouter = Router();
statsRouter.get('/overview',   asyncHandler(stats.overview));
statsRouter.get('/prices',     asyncHandler(stats.prices));
statsRouter.get('/top-models', asyncHandler(stats.topModels));
statsRouter.get('/coverage',   asyncHandler(stats.coverage));
statsRouter.get('/volume',     asyncHandler(stats.volume));
