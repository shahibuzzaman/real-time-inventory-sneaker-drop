import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { emitToDropsRoom } from '../socket';

const schema = z.object({
  event: z.enum(['drop:updated', 'drop:activity', 'drop:created']),
  payload: z.unknown()
});

export const broadcastRouter = Router();

broadcastRouter.post('/', (req, res) => {
  const token = req.header('x-worker-token');
  if (!token || token !== env.WORKER_TOKEN) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid worker token'
      }
    });
    return;
  }

  const payload = schema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid broadcast payload',
        details: payload.error.issues
      }
    });
    return;
  }

  emitToDropsRoom(payload.data.event, payload.data.payload);
  res.status(202).json({ ok: true });
});
