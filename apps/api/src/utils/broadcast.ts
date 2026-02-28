import { env } from '../config/env';
import { logger } from './logger';

export type BroadcastEvent = 'drop:updated' | 'drop:activity' | 'drop:created';

export const broadcastEvent = async (event: BroadcastEvent, payload: unknown): Promise<void> => {
  if (!env.WORKER_TOKEN) {
    return;
  }

  try {
    const response = await fetch(`${env.WORKER_URL}/broadcast`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-worker-token': env.WORKER_TOKEN
      },
      body: JSON.stringify({ event, payload })
    });

    if (!response.ok) {
      logger.warn(
        { event, status: response.status },
        'Worker broadcast endpoint returned non-success status'
      );
    }
  } catch (error) {
    logger.warn({ err: error, event }, 'Unable to broadcast event to worker');
  }
};
