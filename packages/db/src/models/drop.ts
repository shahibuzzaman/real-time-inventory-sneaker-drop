import { DataTypes, Model } from 'sequelize';
import type { CreationOptional, InferAttributes, InferCreationAttributes, Sequelize } from 'sequelize';

export class Drop extends Model<InferAttributes<Drop>, InferCreationAttributes<Drop>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare priceCents: number;
  declare startsAt: Date;
  declare totalStock: number;
  declare availableStock: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    Drop.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        priceCents: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        startsAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        totalStock: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        availableStock: {
          type: DataTypes.INTEGER,
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
        tableName: 'Drops'
      }
    );
  }
}
