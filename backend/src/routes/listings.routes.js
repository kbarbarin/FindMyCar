import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getById } from '../controllers/listings.controller.js';

export const listingsRouter = Router();
listingsRouter.get('/:id', asyncHandler(getById));
