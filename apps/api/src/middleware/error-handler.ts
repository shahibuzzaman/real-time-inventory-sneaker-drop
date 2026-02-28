import type { NextFunction, Request, Response } from 'express';
import { UniqueConstraintError } from 'sequelize';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error';
import { logger } from '../utils/logger';

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  void _next;

  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: error.issues
      }
    });
    return;
  }

  if (error instanceof UniqueConstraintError) {
    const constraintName = (error.parent as { constraint?: string } | undefined)?.constraint;
    const paths = error.errors.map((item) => item.path);

    if (constraintName === 'drops_name_unique_idx' || paths.includes('name')) {
      res.status(409).json({
        error: {
          code: 'DROP_NAME_EXISTS',
          message: 'Drop name already exists'
        }
      });
      return;
    }

    if (paths.includes('username')) {
      res.status(409).json({
        error: {
          code: 'USERNAME_EXISTS',
          message: 'Username already exists'
        }
      });
      return;
    }

    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'Resource already exists'
      }
    });
    return;
  }

  logger.error({ err: error }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error'
    }
  });
};
