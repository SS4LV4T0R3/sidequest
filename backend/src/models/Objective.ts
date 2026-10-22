import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Objective extends Model {
  declare id: number;
  declare questId: number;
  declare title: string;
  declare description: string;
  declare orderIndex: number;
}

Objective.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  questId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  orderIndex: { type: DataTypes.INTEGER, defaultValue: 1 }
}, { sequelize, tableName: 'objectives' });
