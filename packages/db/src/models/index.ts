import type { Sequelize } from 'sequelize';
import { Drop } from './drop';
import { Purchase } from './purchase';
import { RefreshToken } from './refresh-token';
import { Reservation } from './reservation';
import { User } from './user';

export const initModels = (sequelize: Sequelize): void => {
  User.initModel(sequelize);
  Drop.initModel(sequelize);
  Reservation.initModel(sequelize);
  Purchase.initModel(sequelize);
  RefreshToken.initModel(sequelize);

  Drop.hasMany(Reservation, { foreignKey: 'dropId' });
  Reservation.belongsTo(Drop, { foreignKey: 'dropId' });

  User.hasMany(Reservation, { foreignKey: 'userId' });
  Reservation.belongsTo(User, { foreignKey: 'userId' });

  Reservation.hasOne(Purchase, { foreignKey: 'reservationId' });
  Purchase.belongsTo(Reservation, { foreignKey: 'reservationId' });

  Drop.hasMany(Purchase, { foreignKey: 'dropId' });
  Purchase.belongsTo(Drop, { foreignKey: 'dropId' });

  User.hasMany(Purchase, { foreignKey: 'userId' });
  Purchase.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(RefreshToken, { foreignKey: 'userId' });
  RefreshToken.belongsTo(User, { foreignKey: 'userId' });
};

export { Drop, Purchase, RefreshToken, Reservation, User };
export { UserRole } from './user';
export { ReservationStatus } from './reservation';
