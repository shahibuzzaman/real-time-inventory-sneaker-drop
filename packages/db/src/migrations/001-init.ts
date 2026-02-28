import { DataTypes, literal } from 'sequelize';
import type { QueryInterface } from 'sequelize';

export const up = async ({ context: queryInterface }: { context: QueryInterface }): Promise<void> => {
  const sequelize = queryInterface.sequelize;

  await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  await queryInterface.createTable('Users', {
    id: {
      type: DataTypes.UUID,
      defaultValue: literal('uuid_generate_v4()'),
      primaryKey: true,
      allowNull: false
    },
    username: {
      type: DataTypes.STRING,
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
  });

  await queryInterface.createTable('Drops', {
    id: {
      type: DataTypes.UUID,
      defaultValue: literal('uuid_generate_v4()'),
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
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
  });

  await sequelize.query(
    'ALTER TABLE "Drops" ADD CONSTRAINT "drops_total_stock_nonnegative" CHECK ("totalStock" >= 0);'
  );
  await sequelize.query(
    'ALTER TABLE "Drops" ADD CONSTRAINT "drops_available_stock_nonnegative" CHECK ("availableStock" >= 0);'
  );
  await queryInterface.addIndex('Drops', ['startsAt']);
  await queryInterface.addIndex('Drops', ['availableStock']);

  await queryInterface.createTable('Reservations', {
    id: {
      type: DataTypes.UUID,
      defaultValue: literal('uuid_generate_v4()'),
      primaryKey: true,
      allowNull: false
    },
    dropId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Drops',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
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
    status: {
      type: DataTypes.STRING(20),
      allowNull: false
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
  });

  await sequelize.query(
    `ALTER TABLE "Reservations" ADD CONSTRAINT "reservations_valid_status" CHECK (status IN ('ACTIVE','EXPIRED','PURCHASED','CANCELED'));`
  );
  await queryInterface.addIndex('Reservations', ['status', 'expiresAt']);
  await queryInterface.addIndex('Reservations', ['dropId', 'status']);

  await queryInterface.createTable('Purchases', {
    id: {
      type: DataTypes.UUID,
      defaultValue: literal('uuid_generate_v4()'),
      primaryKey: true,
      allowNull: false
    },
    dropId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Drops',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
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
    reservationId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'Reservations',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
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

  await queryInterface.addIndex('Purchases', ['dropId', 'createdAt']);
};

export const down = async ({ context: queryInterface }: { context: QueryInterface }): Promise<void> => {
  await queryInterface.dropTable('Purchases');
  await queryInterface.dropTable('Reservations');
  await queryInterface.dropTable('Drops');
  await queryInterface.dropTable('Users');
};
