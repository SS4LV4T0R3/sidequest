import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database'; 

export class Quest extends Model {
  declare id: string;
  declare title: string;
  declare presentation: string;
  declare category: string;
  declare type: 'ORDINARY' | 'SECRET_TIMED';
  declare timeLimitSeconds: number | null;
  declare latitude: number | null;
  declare longitude: number | null;
  declare status: 'DRAFT' | 'PUBLISHED';
  declare creatorId: string;
}

// Inizializzazione della tabella Sequelize
Quest.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: { type: DataTypes.STRING, allowNull: false },
    presentation: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    timeLimitSeconds: { type: DataTypes.INTEGER, allowNull: true },
    latitude: { type: DataTypes.FLOAT, allowNull: true },
    longitude: { type: DataTypes.FLOAT, allowNull: true },
    status: { type: DataTypes.STRING, defaultValue: 'DRAFT', allowNull: false },
    creatorId: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'Quest',
    tableName: 'Quests',
    timestamps: true,
  }
);