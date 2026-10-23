import { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { UniqueConstraintError, ValidationError } from 'sequelize';
import { AccountError } from '../services/AccountService';

export function handleAsync(action: (request: Request, response: Response) => Promise<unknown>): RequestHandler {
  // Inoltra gli errori asincroni al gestore comune.
  return (request, response, next) => { action(request, response).catch(next); };
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof AccountError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof UniqueConstraintError) {
    response.status(409).json({ error: { code: 'ACCOUNT_CONFLICT', message: 'Email o nickname già utilizzati.' } });
    return;
  }
  if (error instanceof ValidationError) {
    response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Dati non validi.' } });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } });
    return;
  }
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Request body exceeds 32 KB' } });
    return;
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    if (error.status === 400) {
      response.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Richiesta non valida.' } });
      return;
    }
    if (error.status === 415) {
      response.status(415).json({ error: { code: 'UNSUPPORTED_FORMAT', message: 'Codifica della richiesta non supportata.' } });
      return;
    }
  }
  console.error('Unexpected request error:', error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
};
