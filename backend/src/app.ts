import express, { ErrorRequestHandler } from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { UniqueConstraintError, ValidationError } from 'sequelize';
import { config } from './config/environment';
import { sequelize } from './config/database';
import { accountRouter } from './routes/accounts';
import { AccountError } from './services/AccountService';

export const app = express();

app.disable('x-powered-by');
// App Service inoltra le richieste attraverso il proprio proxy.
if (config.nodeEnv === 'production') app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', async (_request, response) => {
  try {
    await sequelize.authenticate();
    response.json({
      status: 'ok',
      serverNow: new Date().toISOString(),
      timezone: config.timezone,
      database: 'up'
    });
  } catch {
    response.status(503).json({
      status: 'error',
      serverNow: new Date().toISOString(),
      timezone: config.timezone,
      database: 'down'
    });
  }
});

app.use('/api', accountRouter);

const frontendDirectory = path.resolve(__dirname, '../public');
if (existsSync(path.join(frontendDirectory, 'index.html'))) {
  app.use(express.static(frontendDirectory, {
    setHeaders(response, filePath) {
      // Angular cambia il nome dei bundle a ogni modifica: si possono conservare in cache.
      const fingerprinted = /-[A-Z0-9]{8}\.(js|css)$/i.test(path.basename(filePath));
      response.setHeader('Cache-Control', fingerprinted ? 'public, max-age=31536000, immutable' : 'no-cache');
    }
  }));
  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(path.join(frontendDirectory, 'index.html'));
  });
}

app.use((_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (response.headersSent) {
    _next(error);
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
  console.error('Unexpected request error:', error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
};

app.use(errorHandler);
