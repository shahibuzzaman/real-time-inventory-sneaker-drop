import { DataTypes, Model } from 'sequelize';
import type {
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Sequelize
} from 'sequelize';
import type { Drop } from './drop';
import type { User } from './user';

export const ReservationStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  PURCHASED: 'PURCHASED',
  CANCELED: 'CANCELED'
} as const;

export type ReservationStatusType = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export class Reservation extends Model<
  InferAttributes<Reservation>,
  InferCreationAttributes<Reservation>
> {
  declare id: CreationOptional<string>;
  declare dropId: ForeignKey<Drop['id']>;
  declare userId: ForeignKey<User['id']>;
  declare status: ReservationStatusType;
  declare expiresAt: Date;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    Reservation.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        dropId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        status: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: ReservationStatus.ACTIVE
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      },
      {
        sequelize,
        tableName: 'Reservations'
      }
    );
  }
}
