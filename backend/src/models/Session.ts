import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

interface SessionAttributes {
  id: string;
  userId: number;
  expiresAt: Date;
}

// id contiene il digest del token; il valore del cookie non viene salvato.
export class Session extends Model<SessionAttributes> implements SessionAttributes {
  declare id: string;
  declare userId: number;
  declare expiresAt: Date;
}

Session.init({
  id: { type: DataTypes.STRING(64), primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false }
}, {
  sequelize,
  tableName: 'sessions',
  indexes: [{ fields: ['userId'] }, { fields: ['expiresAt'] }]
});
