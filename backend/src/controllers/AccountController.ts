import { Request, Response } from 'express';
import { User } from '../models';
import { AccountService, SESSION_DURATION_MS, userProfile } from '../services/AccountService';
import { cookieName, cookieOptions, readToken } from '../middleware/authentication';

export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  register = async (request: Request, response: Response): Promise<void> => {
    const user = await this.accounts.createUser(request.body);
    response.status(201).json({ user: userProfile(user) });
  };

  login = async (request: Request, response: Response): Promise<void> => {
    const result = await this.accounts.login(request.body, readToken(request));
    response.cookie(cookieName, result.token, {
      ...cookieOptions, maxAge: SESSION_DURATION_MS, expires: result.expiresAt
    });
    response.json({ user: result.user });
  };

  logout = async (request: Request, response: Response): Promise<void> => {
    await this.accounts.logout(readToken(request));
    response.clearCookie(cookieName, cookieOptions);
    response.sendStatus(204);
  };

  profile = async (_request: Request, response: Response): Promise<void> => {
    response.json({ user: userProfile(response.locals.user as User) });
  };

  updateProfile = async (request: Request, response: Response): Promise<void> => {
    const user = await this.accounts.updateProfile(response.locals.user as User, request.body);
    response.json({ user: userProfile(user) });
  };

  listUsers = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.accounts.listUsers(Number(request.query.page ?? 1), Number(request.query.pageSize ?? 20)));
  };

  setActive = async (request: Request, response: Response): Promise<void> => {
    const user = await this.accounts.setActive(Number(request.params.id), request.body);
    response.json({ user: userProfile(user) });
  };
}
