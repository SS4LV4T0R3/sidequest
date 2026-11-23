import { RequestHandler } from 'express';
import { AccountError } from '../services/AccountService';

// Limite locale al processo, sufficiente per la prima versione a istanza singola.
const attempts = new Map<string, { count: number; expiresAt: number }>();

export const rateLimit: RequestHandler = (request, response, next) => {
  const now = Date.now();
  for (const [key, attempt] of attempts) {
    if (attempt.expiresAt <= now) {
      attempts.delete(key);
    }
  }
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
