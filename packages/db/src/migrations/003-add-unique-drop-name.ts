import type { QueryInterface } from 'sequelize';

export const up = async ({ context: queryInterface }: { context: QueryInterface }): Promise<void> => {
  await queryInterface.addIndex('Drops', ['name'], {
    name: 'drops_name_unique_idx',
    unique: true
  });
};

export const down = async ({ context: queryInterface }: { context: QueryInterface }): Promise<void> => {
  await queryInterface.removeIndex('Drops', 'drops_name_unique_idx');
};
