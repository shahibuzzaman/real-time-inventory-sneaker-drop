import { connectDb } from '@sneaker-drop/db';
import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

const start = async (): Promise<void> => {
  await connectDb();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'API listening');
  });
};

void start().catch((error) => {
  logger.error({ err: error }, 'Failed to start API');
  process.exit(1);
});
