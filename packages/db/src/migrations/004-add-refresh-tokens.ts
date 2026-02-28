import { DataTypes, literal } from 'sequelize';
import type { QueryInterface } from 'sequelize';

export const up = async ({ context: queryInterface }: { context: QueryInterface }): Promise<void> => {
  await queryInterface.createTable('RefreshTokens', {
    id: {
      type: DataTypes.UUID,
      defaultValue: literal('uuid_generate_v4()'),
      primaryKey: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
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
  });

  await queryInterface.addIndex('RefreshTokens', ['userId']);
  await queryInterface.addIndex('RefreshTokens', ['expiresAt']);
  await queryInterface.addIndex('RefreshTokens', ['revokedAt']);
};

export const down = async ({ context: queryInterface }: { context: QueryInterface }): Promise<void> => {
  await queryInterface.dropTable('RefreshTokens');
};
