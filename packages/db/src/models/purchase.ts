import { DataTypes, Model } from 'sequelize';
import type {
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Sequelize
} from 'sequelize';
import type { Drop } from './drop';
import type { Reservation } from './reservation';
import type { User } from './user';

export class Purchase extends Model<InferAttributes<Purchase>, InferCreationAttributes<Purchase>> {
  declare id: CreationOptional<string>;
  declare dropId: ForeignKey<Drop['id']>;
  declare userId: ForeignKey<User['id']>;
  declare reservationId: ForeignKey<Reservation['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    Purchase.init(
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
        reservationId: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true
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
        tableName: 'Purchases'
      }
    );
  }
}
