import path from 'node:path';

export const SERVER_TIMEZONE = 'Europe/Rome';

export interface RuntimeConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number | string;
  timezone: typeof SERVER_TIMEZONE;
  corsOrigin: string;
  databaseStorage: string;
}

export function createRuntimeConfig(env: NodeJS.ProcessEnv, backendDirectory: string): RuntimeConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (nodeEnv !== 'development' && nodeEnv !== 'test' && nodeEnv !== 'production') {
    throw new Error('NODE_ENV must be development, test or production');
  }
  if (env.TZ && env.TZ !== SERVER_TIMEZONE) {
    throw new Error('TZ must be Europe/Rome');
  }
  if (env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not supported: this version uses SQLite through DB_STORAGE');
  }
  const rawPort = env.PORT ?? '3000';
  // IIS su Azure Windows inoltra le richieste a Node tramite una named pipe.
  const namedPipe = process.platform === 'win32' && nodeEnv === 'production'
    && /^\\\\\.\\pipe\\[^\\]+$/.test(rawPort);
  const numericPort = Number(rawPort);
  if (!namedPipe && (!/^\d+$/.test(rawPort) || !Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const port = namedPipe ? rawPort : numericPort;
  const host = env.HOST ?? '127.0.0.1';
  if (!host.trim() || host !== host.trim()) {
    throw new Error('HOST must not be empty or contain surrounding whitespace');
  }

  const corsOrigin = env.CORS_ORIGIN ?? 'http://localhost:4200';
  let originUrl: URL;
  try {
    originUrl = new URL(corsOrigin);
  } catch {
    throw new Error('CORS_ORIGIN must be a single HTTP or HTTPS origin');
  }
  if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.origin !== corsOrigin) {
    throw new Error('CORS_ORIGIN must be a single HTTP or HTTPS origin without a path');
  }

  const storage = env.DB_STORAGE ?? './database.sqlite';
  if (!storage.trim()) {
    throw new Error('DB_STORAGE must not be empty');
  }
  return {
    nodeEnv,
    host,
    port,
    timezone: SERVER_TIMEZONE,
    corsOrigin,
    databaseStorage: storage === ':memory:' ? storage : path.resolve(backendDirectory, storage)
  };
}
