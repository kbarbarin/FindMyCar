import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { search } from '../controllers/search.controller.js';
import { searchStream } from '../controllers/stream.controller.js';

export const searchRouter = Router();
searchRouter.get('/', asyncHandler(search));
searchRouter.get('/stream', asyncHandler(searchStream));
