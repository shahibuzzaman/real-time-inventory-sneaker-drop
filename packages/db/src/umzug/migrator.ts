import path from 'node:path';
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from '../sequelize';

const migrationGlob = __filename.endsWith('.ts')
  ? path.join(__dirname, '../migrations/*.ts')
  : path.join(__dirname, '../migrations/*.js');

export const migrator = new Umzug({
  migrations: {
    glob: migrationGlob
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console
});
