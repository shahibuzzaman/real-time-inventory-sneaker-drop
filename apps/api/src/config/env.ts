import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../../.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  WORKER_URL: z.string().url().default('http://localhost:3002'),
  WORKER_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().min(12).default('local-dev-jwt-secret'),
  JWT_REFRESH_SECRET: z.string().min(12).default('local-dev-refresh-jwt-secret'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default('refreshToken'),
  LOG_LEVEL: z.string().default('info')
});

export const env = envSchema.parse(process.env);
