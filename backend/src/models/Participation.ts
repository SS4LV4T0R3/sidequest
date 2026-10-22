import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Participation extends Model {
  declare id: number;
  declare userId: number;
  declare questId: number;
  declare status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED';
  declare acceptedAt: Date;
  declare expiresAt: Date | null;
  declare completedAt: Date | null;
  declare proofText: string | null;
  declare proofImageUrl: string | null;
}

Participation.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  questId: { type: DataTypes.INTEGER, allowNull: false },
  status: {
    type: DataTypes.ENUM('IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'EXPIRED'),
    defaultValue: 'IN_PROGRESS'
  },
  acceptedAt: { type: DataTypes.DATE, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  proofText: { type: DataTypes.TEXT, allowNull: true },
  proofImageUrl: { type: DataTypes.STRING, allowNull: true }
}, { sequelize, tableName: 'participations' });
