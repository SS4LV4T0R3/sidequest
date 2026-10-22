import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface QuestAttributes {
  id: number;
  authorId: number;
  title: string;
  summary: string;
  category: string;
  mode: 'ORDINARY' | 'SECRET_TIMED';
  durationMinutes?: number | null;
  latitude: number | null;
  longitude: number | null;
  locationName?: string | null;
  points: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export class Quest extends Model<QuestAttributes, Optional<QuestAttributes, 'id' | 'status' | 'points' | 'latitude' | 'longitude'>> implements QuestAttributes {
  declare id: number;
  declare authorId: number;
  declare title: string;
  declare summary: string;
  declare category: string;
  declare mode: 'ORDINARY' | 'SECRET_TIMED';
  declare durationMinutes?: number | null;
  declare latitude: number | null;
  declare longitude: number | null;
  declare locationName?: string | null;
  declare points: number;
  declare status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

Quest.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  authorId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(120), allowNull: false },
  summary: { type: DataTypes.TEXT, allowNull: false },
  category: { type: DataTypes.STRING(50), allowNull: false },
  mode: { type: DataTypes.ENUM('ORDINARY', 'SECRET_TIMED'), allowNull: false },
  durationMinutes: { type: DataTypes.INTEGER, allowNull: true },
  latitude: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
  longitude: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
  locationName: { type: DataTypes.STRING, allowNull: true },
  points: { type: DataTypes.INTEGER, defaultValue: 100 },
  status: { type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'), defaultValue: 'DRAFT' }
}, {
  sequelize,
  tableName: 'quests',
  validate: {
    coordinatesPair(this: Quest): void {
      const latitude = this.latitude;
      const longitude = this.longitude;
      if ((latitude != null) !== (longitude != null)) {
        throw new Error('Latitude and longitude must be provided together');
      }
      if (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
        throw new Error('Latitude must be between -90 and 90');
      }
      if (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
        throw new Error('Longitude must be between -180 and 180');
      }
    }
  }
});
