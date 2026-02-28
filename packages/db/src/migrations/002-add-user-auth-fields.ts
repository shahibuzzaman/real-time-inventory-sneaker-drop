import { DataTypes } from 'sequelize';
import type { QueryInterface } from 'sequelize';

export const up = async ({ context: queryInterface }: { context: QueryInterface }): Promise<void> => {
  await queryInterface.addColumn('Users', 'passwordHash', {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  });

  await queryInterface.addColumn('Users', 'role', {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'USER'
  });

  await queryInterface.sequelize.query(
    `ALTER TABLE "Users" ADD CONSTRAINT "users_valid_role" CHECK (role IN ('ADMIN','USER'));`
  );
  await queryInterface.addIndex('Users', ['role']);
};

export const down = async ({ context: queryInterface }: { context: QueryInterface }): Promise<void> => {
  await queryInterface.removeIndex('Users', ['role']);
  await queryInterface.sequelize.query('ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "users_valid_role";');
  await queryInterface.removeColumn('Users', 'role');
  await queryInterface.removeColumn('Users', 'passwordHash');
};
