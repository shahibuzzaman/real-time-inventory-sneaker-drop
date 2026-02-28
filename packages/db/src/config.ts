import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../../.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).optional(),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('sneaker_drop'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres')
});

const env = envSchema.parse(process.env);

export type DbConfig =
  | { url: string }
  | {
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
    };

export const getDbConfig = (): DbConfig => {
  if (env.NODE_ENV === 'test' && env.TEST_DATABASE_URL) {
    return { url: env.TEST_DATABASE_URL };
  }

  if (env.DATABASE_URL) {
    return { url: env.DATABASE_URL };
  }

  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASSWORD
  };
};
