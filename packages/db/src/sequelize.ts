import { Sequelize } from 'sequelize';
import { getDbConfig } from './config';
import { initModels } from './models';

const dbConfig = getDbConfig();
const shouldUseSsl =
  process.env.DB_SSL === 'true' ||
  ('url' in dbConfig && /neon\.tech/i.test(dbConfig.url)) ||
  ('url' in dbConfig && /sslmode=require/i.test(dbConfig.url));

const sslOptions = shouldUseSsl
  ? {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
        }
      }
    }
  : {};

export const sequelize =
  'url' in dbConfig
    ? new Sequelize(dbConfig.url, {
        dialect: 'postgres',
        logging: false,
        ...sslOptions
      })
    : new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: 'postgres',
        logging: false,
        ...sslOptions
      });

initModels(sequelize);

export const connectDb = async (): Promise<void> => {
  await sequelize.authenticate();
};

export const closeDb = async (): Promise<void> => {
  await sequelize.close();
};
