import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { apiRouter } from './routes';
import { logger } from './utils/logger';

const app = express();

app.use(
  pinoHttp({
    logger
  })
);
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json());

app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
