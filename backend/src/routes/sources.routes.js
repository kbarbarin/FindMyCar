import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { list } from '../controllers/sources.controller.js';

export const sourcesRouter = Router();
sourcesRouter.get('/', asyncHandler(list));
