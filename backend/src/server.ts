import { Server } from 'node:http';
import { app } from './app';
import { config } from './config/environment';
import { sequelize } from './config/database';
import './models';

async function startServer(): Promise<void> {
  await sequelize.authenticate();
  const server = await new Promise<Server>((resolve, reject) => {
    const onListening = () => resolve(listener);
    const listener = typeof config.port === 'string'
      ? app.listen(config.port, onListening)
      : app.listen(config.port, config.host, onListening);
    listener.once('error', reject);
  });
  console.log(`SideQuest API listening on http://${config.host}:${config.port}`);

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => {
      console.error('Shutdown timed out');
      process.exit(1);
    }, 10_000);
    deadline.unref();

    server.close(async (error) => {
      try {
        await sequelize.close();
        if (error) throw error;
      } catch (closeError) {
        console.error('Unable to close server cleanly:', closeError);
        process.exitCode = 1;
      } finally {
        clearTimeout(deadline);
      }
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch(async (error: unknown) => {
  console.error('Unable to start SideQuest API:', error);
  await sequelize.close().catch(() => undefined);
  process.exitCode = 1;
});
