import { DataTypes, Model } from 'sequelize';
import type {
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Sequelize
} from 'sequelize';
import type { User } from './user';

export class RefreshToken extends Model<
  InferAttributes<RefreshToken>,
  InferCreationAttributes<RefreshToken>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User['id']>;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare revokedAt: Date | null;
  declare replacedByTokenId: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    RefreshToken.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        tokenHash: {
          type: DataTypes.STRING(128),
          allowNull: false,
          unique: true
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        revokedAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        replacedByTokenId: {
          type: DataTypes.UUID,
          allowNull: true
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
        tableName: 'RefreshTokens'
      }
    );
  }
}
