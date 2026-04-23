import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { search } from '../controllers/search.controller.js';

export const searchRouter = Router();
searchRouter.get('/', asyncHandler(search));
