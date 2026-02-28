import cors from 'cors';
import express from 'express';
import pinoHttp from 'pino-http';
import { broadcastRouter } from './routes/broadcast';
import { logger } from './utils/logger';

const app = express();

app.use(
  pinoHttp({
    logger
  })
);
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/broadcast', broadcastRouter);

export default app;
