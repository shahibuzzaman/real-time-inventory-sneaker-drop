import type { Request, Response } from 'express';

type JsonErrorResponse = Response & {
  status: (code: number) => JsonErrorResponse;
  json: (body: unknown) => JsonErrorResponse;
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  const response = res as JsonErrorResponse;
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  });
};
