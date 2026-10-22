import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface UserAttributes {
  id: number;
  email: string;
  passwordHash: string;
  nickname: string;
  bio?: string | null;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  score: number;
}

export class User extends Model<UserAttributes, Optional<UserAttributes, 'id' | 'role' | 'score' | 'isActive'>> implements UserAttributes {
  declare id: number;
  declare email: string;
  declare passwordHash: string;
  declare nickname: string;
  declare bio?: string | null;
  declare role: 'USER' | 'ADMIN';
  declare isActive: boolean;
  declare score: number;
}

User.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  nickname: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  bio: { type: DataTypes.TEXT, allowNull: true },
  role: { type: DataTypes.ENUM('USER', 'ADMIN'), defaultValue: 'USER' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  score: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { sequelize, tableName: 'users' });
