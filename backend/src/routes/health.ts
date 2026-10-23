import { Router } from 'express';
import { HealthController } from '../controllers/HealthController';
import { handleAsync } from '../middleware/errorHandler';

const controller = new HealthController();

export const healthRouter = Router();

healthRouter.get('/health', handleAsync(controller.check));
