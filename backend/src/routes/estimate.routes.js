import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { estimate } from '../controllers/estimate.controller.js';

export const estimateRouter = Router();
estimateRouter.get('/', asyncHandler(estimate));
estimateRouter.post('/', asyncHandler(estimate));
