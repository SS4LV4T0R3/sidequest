import { User } from './User';
import { Quest } from './Quest';
import { Objective } from './Objective';
import { Participation } from './Participation';
import { Notification } from './Notification';
import { Session } from './Session';

User.hasMany(Quest, { foreignKey: 'authorId', as: 'createdQuests' });
Quest.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

Quest.hasMany(Objective, { foreignKey: 'questId', as: 'objectives', onDelete: 'CASCADE' });
Objective.belongsTo(Quest, { foreignKey: 'questId' });

User.hasMany(Participation, { foreignKey: 'userId', as: 'participations' });
Participation.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Quest.hasMany(Participation, { foreignKey: 'questId', as: 'participations' });
Participation.belongsTo(Quest, { foreignKey: 'questId', as: 'quest' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Session, { foreignKey: 'userId', as: 'sessions', onDelete: 'CASCADE' });
Session.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export { User, Quest, Objective, Participation, Notification, Session };
export type { UserAttributes } from './User';
export type { QuestAttributes } from './Quest';
