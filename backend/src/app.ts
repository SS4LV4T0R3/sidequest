import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { config } from './config/environment';
import { errorHandler } from './middleware/errorHandler';
import { accountRouter } from './routes/accounts';
import { healthRouter } from './routes/health';

export const app = express();

app.disable('x-powered-by');
// App Service inoltra le richieste attraverso il proprio proxy.
if (config.nodeEnv === 'production') app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));

app.use('/api', healthRouter);
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

app.use(errorHandler);
