import { RequestHandler } from 'express';
import { config } from '../config/environment';
import { AccountError } from '../services/AccountService';

export const accountRequests: RequestHandler = (request, response, next) => {
  response.set('Cache-Control', 'no-store');
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method)) {
    const origin = request.get('Origin');
    const ownOrigin = `${request.protocol}://${request.get('host')}`;
    const allowedOrigin = origin === undefined || origin === config.corsOrigin || origin === ownOrigin;
    const crossSiteWithoutOrigin = request.get('Sec-Fetch-Site') === 'cross-site' && origin === undefined;
    // L'header personalizzato impedisce i POST semplici dei form di altri siti.
    if (request.get('X-Requested-With') !== 'XMLHttpRequest'
      || !allowedOrigin || crossSiteWithoutOrigin) {
      next(new AccountError(403, 'INVALID_ORIGIN', 'Origine della richiesta non consentita.'));
      return;
    }
    if (request.path !== '/auth/logout' && !request.is('application/json')) {
      next(new AccountError(415, 'JSON_REQUIRED', 'La richiesta deve usare application/json.'));
      return;
    }
  }
  next();
};
