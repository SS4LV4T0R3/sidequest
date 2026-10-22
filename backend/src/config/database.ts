import { Sequelize } from 'sequelize';
import { config } from './environment';

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: config.databaseStorage,
  logging: false
});
