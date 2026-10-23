import { Router } from 'express';
import { AccountController } from '../controllers/AccountController';
import { accountRequests } from '../middleware/accountRequests';
import { requireAdmin, requireUser } from '../middleware/authentication';
import { handleAsync } from '../middleware/errorHandler';
import { rateLimit } from '../middleware/rateLimit';
import { AccountService } from '../services/AccountService';

const accounts = new AccountService();
const controller = new AccountController(accounts);
const authenticate = requireUser(accounts);

export const accountRouter = Router();

accountRouter.use(accountRequests);

accountRouter.post('/auth/register', rateLimit, handleAsync(controller.register));
accountRouter.post('/auth/login', rateLimit, handleAsync(controller.login));
accountRouter.post('/auth/logout', handleAsync(controller.logout));
accountRouter.get('/users/me', authenticate, handleAsync(controller.profile));
accountRouter.patch('/users/me', authenticate, handleAsync(controller.updateProfile));
accountRouter.get('/admin/users', authenticate, requireAdmin, handleAsync(controller.listUsers));
accountRouter.patch('/admin/users/:id/status', authenticate, requireAdmin, handleAsync(controller.setActive));
