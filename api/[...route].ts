import type { IncomingMessage, ServerResponse } from 'node:http';
// Force Vercel file tracing to include postgres driver used by Sequelize.
// If unavailable at runtime, request-level DB init will return a controlled 503.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('pg');
} catch {
  // Optional pre-require for tracing; runtime path is handled by lazy init fallback.
  void 0;
}

let dbReadyPromise: Promise<void> | null = null;
let connectDbFn: (() => Promise<void>) | null = null;
let appHandler:
  | ((
      request: IncomingMessage,
      response: ServerResponse,
      next?: (error?: unknown) => void
    ) => void)
  | null = null;
const DB_INIT_TIMEOUT_MS = Number.parseInt(process.env.DB_INIT_TIMEOUT_MS ?? '8000', 10);

const getConnectDb = async (): Promise<() => Promise<void>> => {
  if (!connectDbFn) {
    const db = await import('@sneaker-drop/db');
    connectDbFn = db.connectDb;
  }

  return connectDbFn;
};

const ensureDbConnection = async (): Promise<void> => {
  if (!dbReadyPromise) {
    const connectDb = await getConnectDb();
    dbReadyPromise = connectDb().catch((error: unknown) => {
      dbReadyPromise = null;
      throw error;
    });
  }

  await dbReadyPromise;
};

const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(label));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const getAppHandler = (): ((
  request: IncomingMessage,
  response: ServerResponse,
  next?: (error?: unknown) => void
) => void) => {
  if (!appHandler) {
    // Load compiled API app to avoid Vercel type-checking API source with a different TS context.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    appHandler = require('../apps/api/dist/app').default as (
      request: IncomingMessage,
      response: ServerResponse,
      next?: (error?: unknown) => void
    ) => void;
  }

  return appHandler;
};

type ApiRequest = IncomingMessage & { method?: string; url?: string };
type ApiResponse = ServerResponse<IncomingMessage> & {
  status?: (code: number) => unknown;
  json?: (body: unknown) => void;
};

const writeJson = (res: ApiResponse, statusCode: number, payload: unknown): void => {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode);
    res.json(payload);
    return;
  }

  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
};

const normalizeApiPath = (path: string): string => {
  const prefixed = path.startsWith('/') ? path : `/${path}`;
  let normalized = prefixed;

  while (normalized === '/api/api' || normalized.startsWith('/api/api/')) {
    normalized = normalized.slice(4);
  }

  if (normalized.startsWith('/api')) {
    return normalized;
  }

  return `/api${normalized}`;
};

const invokeApp = async (
  app: (request: IncomingMessage, response: ServerResponse, next?: (error?: unknown) => void) => void,
  req: ApiRequest,
  res: ApiResponse
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = (): void => {
      res.off('finish', onFinish);
      res.off('close', onClose);
      res.off('error', onError);
    };

    const resolveOnce = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const rejectOnce = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const onFinish = (): void => resolveOnce();
    const onClose = (): void => resolveOnce();
    const onError = (error: Error): void => rejectOnce(error);

    res.once('finish', onFinish);
    res.once('close', onClose);
    res.once('error', onError);

    try {
      app(req, res, (error?: unknown) => {
        if (error) {
          rejectOnce(error);
          return;
        }

        if (res.writableEnded) {
          resolveOnce();
        }
      });
    } catch (error) {
      rejectOnce(error);
    }
  });
};

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const fullUrl = req.url ?? '/';
  const [pathPart, queryPart] = fullUrl.split('?', 2);
  const path = pathPart ?? '/';
  const isHealthCheck = req.method === 'GET' && (path === '/api/health' || path === '/health');

  // Keep health lightweight and independent of DB/app module startup.
  if (isHealthCheck) {
    writeJson(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    const normalizedPath = normalizeApiPath(path);
    if (normalizedPath !== path) {
      req.url = queryPart ? `${normalizedPath}?${queryPart}` : normalizedPath;
    }

    await withTimeout(
      ensureDbConnection(),
      DB_INIT_TIMEOUT_MS,
      `Database initialization timed out after ${DB_INIT_TIMEOUT_MS}ms`
    );
    const app = getAppHandler();
    await invokeApp(app, req, res);
  } catch (error) {
    console.error('Failed to initialize API request', error);
    writeJson(res, 503, {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service unavailable'
      }
    });
  }
}
