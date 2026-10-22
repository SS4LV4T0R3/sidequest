import { CookieOptions, Request, RequestHandler, Response, Router } from 'express';
import { config } from '../config/environment';
import { User } from '../models';
import { AccountError, AccountService, SESSION_DURATION_MS, userProfile } from '../services/AccountService';

const accounts = new AccountService();
const cookieName = config.nodeEnv === 'production' ? '__Host-sidequest_session' : 'sidequest_session';
const cookieOptions: CookieOptions = {
  httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/'
};

function readToken(request: Request): string | null {
  const values = (request.headers.cookie ?? '').split(';')
    .map((part) => part.trim()).filter((part) => part.startsWith(`${cookieName}=`));
  if (values.length !== 1) return null;
  const value = values[0].slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function handle(action: (request: Request, response: Response) => Promise<unknown>): RequestHandler {
  return (request, response, next) => { action(request, response).catch(next); };
}

const requireUser: RequestHandler = (request, response, next) => {
  accounts.currentUser(readToken(request)).then((user) => {
    response.locals.user = user;
    next();
  }, next);
};

const requireAdmin: RequestHandler = (_request, response, next) => {
  if ((response.locals.user as User).role !== 'ADMIN') {
    next(new AccountError(403, 'FORBIDDEN', 'Operazione riservata agli amministratori.'));
  } else next();
};

// Limite locale al processo, sufficiente per la prima versione a istanza singola.
const attempts = new Map<string, { count: number; expiresAt: number }>();
const rateLimit: RequestHandler = (request, response, next) => {
  const now = Date.now();
  for (const [key, attempt] of attempts) if (attempt.expiresAt <= now) attempts.delete(key);
  const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
  const attempt = attempts.get(key) ?? { count: 0, expiresAt: now + 15 * 60 * 1000 };
  if (attempt.count >= 40 || (!attempts.has(key) && attempts.size >= 1000)) {
    response.set('Retry-After', String(Math.ceil((attempt.expiresAt - now) / 1000)));
    next(new AccountError(429, 'TOO_MANY_ATTEMPTS', 'Troppi tentativi. Riprovare più tardi.'));
    return;
  }
  attempt.count += 1;
  attempts.set(key, attempt);
  next();
};

export const accountRouter = Router();

accountRouter.use((request, response, next) => {
  response.set('Cache-Control', 'no-store');
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method)) {
    const origin = request.get('Origin');
    const ownOrigin = `${request.protocol}://${request.get('host')}`;
    // L'header personalizzato impedisce i POST semplici dei form di altri siti.
    if (request.get('X-Requested-With') !== 'XMLHttpRequest'
      || (origin !== undefined && origin !== config.corsOrigin && origin !== ownOrigin)
      || (request.get('Sec-Fetch-Site') === 'cross-site' && origin === undefined)) {
      next(new AccountError(403, 'INVALID_ORIGIN', 'Origine della richiesta non consentita.'));
      return;
    }
    if (request.path !== '/auth/logout' && !request.is('application/json')) {
      next(new AccountError(415, 'JSON_REQUIRED', 'La richiesta deve usare application/json.'));
      return;
    }
  }
  next();
});

accountRouter.post('/auth/register', rateLimit, handle(async (request, response) => {
  const user = await accounts.createUser(request.body);
  response.status(201).json({ user: userProfile(user) });
}));

accountRouter.post('/auth/login', rateLimit, handle(async (request, response) => {
  const result = await accounts.login(request.body, readToken(request));
  response.cookie(cookieName, result.token, {
    ...cookieOptions, maxAge: SESSION_DURATION_MS, expires: result.expiresAt
  });
  response.json({ user: result.user });
}));

accountRouter.post('/auth/logout', handle(async (request, response) => {
  await accounts.logout(readToken(request));
  response.clearCookie(cookieName, cookieOptions);
  response.sendStatus(204);
}));

accountRouter.get('/users/me', requireUser, handle(async (_request, response) => {
  response.json({ user: userProfile(response.locals.user as User) });
}));

accountRouter.patch('/users/me', requireUser, handle(async (request, response) => {
  const user = await accounts.updateProfile(response.locals.user as User, request.body);
  response.json({ user: userProfile(user) });
}));

accountRouter.get('/admin/users', requireUser, requireAdmin, handle(async (request, response) => {
  response.json(await accounts.listUsers(Number(request.query.page ?? 1), Number(request.query.pageSize ?? 20)));
}));

accountRouter.patch('/admin/users/:id/status', requireUser, requireAdmin, handle(async (request, response) => {
  const user = await accounts.setActive(Number(request.params.id), request.body);
  response.json({ user: userProfile(user) });
}));
