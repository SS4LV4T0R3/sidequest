import { Request, Response } from 'express';
import { config } from '../config/environment';
import { sequelize } from '../config/database';

export class HealthController {
  check = async (_request: Request, response: Response): Promise<void> => {
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
  };
}
