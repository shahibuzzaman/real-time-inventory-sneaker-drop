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
let appHandler: ((request: IncomingMessage, response: ServerResponse) => void) | null = null;

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
    dbReadyPromise = connectDb();
  }

  await dbReadyPromise;
};

const getAppHandler = (): ((request: IncomingMessage, response: ServerResponse) => void) => {
  if (!appHandler) {
    // Load compiled API app to avoid Vercel type-checking API source with a different TS context.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    appHandler = require('../apps/api/dist/app').default as (
      request: IncomingMessage,
      response: ServerResponse
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
  const statusFn = res.status;
  const jsonFn = res.json;
  if (typeof statusFn === 'function' && typeof jsonFn === 'function') {
    statusFn(statusCode);
    jsonFn(payload);
    return;
  }

  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
};

const normalizeApiPath = (path: string): string => {
  if (path.startsWith('/api')) {
    return path;
  }
  if (path.startsWith('/')) {
    return `/api${path}`;
  }
  return `/api/${path}`;
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

    await ensureDbConnection();
    const app = getAppHandler();
    app(req, res);
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
