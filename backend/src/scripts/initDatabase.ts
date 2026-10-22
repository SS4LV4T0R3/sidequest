import { sequelize } from '../config/database';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/environment';
import '../models';

async function initializeDatabase(): Promise<void> {
  try {
    if (config.databaseStorage !== ':memory:') {
      await mkdir(path.dirname(config.databaseStorage), { recursive: true });
    }
    await sequelize.authenticate();
    // Crea le tabelle mancanti senza modificare quelle esistenti.
    await sequelize.sync();
    console.log(`SQLite schema initialized in ${config.databaseStorage}`);
  } finally {
    await sequelize.close();
  }
}

initializeDatabase().catch((error: unknown) => {
  console.error('Unable to initialize database:', error);
  process.exitCode = 1;
});
