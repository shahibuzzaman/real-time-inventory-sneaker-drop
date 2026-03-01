import { connectDb } from '@sneaker-drop/db';
import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../apps/api/src/app';

let dbReadyPromise: Promise<void> | null = null;

const ensureDbConnection = async (): Promise<void> => {
  if (!dbReadyPromise) {
    dbReadyPromise = connectDb();
  }

  await dbReadyPromise;
};

type ApiRequest = IncomingMessage & { method?: string; url?: string };
type ApiResponse = ServerResponse<IncomingMessage> & {
  status?: (code: number) => unknown;
  json?: (body: unknown) => void;
};

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const path = req.url?.split('?')[0] ?? '';
  const isHealthCheck = req.method === 'GET' && path === '/api/health';

  // Keep /api/health lightweight: do not fail health endpoint on DB cold-start/outage.
  if (!isHealthCheck) {
    try {
      await ensureDbConnection();
    } catch (error) {
      console.error('Failed to connect database before handling request', error);
      const payload = {
        error: {
          code: 'DB_UNAVAILABLE',
          message: 'Database unavailable'
        }
      };

      const statusFn = res.status;
      const jsonFn = res.json;

      if (typeof statusFn === 'function' && typeof jsonFn === 'function') {
        statusFn(503);
        jsonFn(payload);
      } else {
        res.statusCode = 503;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(payload));
      }
      return;
    }
  }

  (app as unknown as (request: IncomingMessage, response: ServerResponse) => void)(req, res);
}
