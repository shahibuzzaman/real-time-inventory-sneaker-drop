import { connectDb } from '@sneaker-drop/db';
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { runExpiryOnce } from './services/expiry';
import { registerSocketServer } from './socket';
import { logger } from './utils/logger';

const start = async (): Promise<void> => {
  await connectDb();

  const httpServer = http.createServer(app);
  const io = new IOServer(httpServer, {
    cors: {
      origin: env.SOCKET_CORS_ORIGIN,
      methods: ['GET', 'POST']
    }
  });

  registerSocketServer(io);

  setInterval(() => {
    void runExpiryOnce().catch((error) => {
      logger.error({ err: error }, 'Failed running expiration tick');
    });
  }, env.EXPIRY_INTERVAL_MS);

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Socket worker listening');
  });
};

void start().catch((error) => {
  logger.error({ err: error }, 'Failed to start socket worker');
  process.exit(1);
});
