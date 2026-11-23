import { CookieOptions, Request, RequestHandler } from 'express';
import { config } from '../config/environment';
import { User } from '../models';
import { AccountError, AccountService } from '../services/AccountService';

export const cookieName = config.nodeEnv === 'production' ? '__Host-sidequest_session' : 'sidequest_session';
export const cookieOptions: CookieOptions = {
  httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/'
};

export function readToken(request: Request): string | null {
  const values = (request.headers.cookie ?? '').split(';')
    .map((part) => part.trim()).filter((part) => part.startsWith(`${cookieName}=`));
  if (values.length !== 1) return null;
  const value = values[0].slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export function requireUser(accounts: AccountService): RequestHandler {
  return (request, response, next) => {
    accounts.currentUser(readToken(request)).then((user) => {
      response.locals.user = user;
      next();
    }, next);
  };
}

export const requireAdmin: RequestHandler = (_request, response, next) => {
  if ((response.locals.user as User).role !== 'ADMIN') {
    next(new AccountError(403, 'FORBIDDEN', 'Operazione riservata agli amministratori.'));
  } else next();
};
