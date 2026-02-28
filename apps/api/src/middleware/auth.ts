import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type AuthClaims = {
  userId: string;
  username: string;
  role: 'ADMIN' | 'USER';
};

const getBearerToken = (request: Request): string | null => {
  const authHeader = request.header('authorization');
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
};

const verifyToken = (token: string): AuthClaims | null => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      sub: string;
      username: string;
      role: 'ADMIN' | 'USER';
      type?: 'access';
    };

    if (!payload.sub || !payload.username || !payload.role) {
      return null;
    }

    if (payload.type && payload.type !== 'access') {
      return null;
    }

    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role
    };
  } catch {
    return null;
  }
};

export const requireAuth = (request: Request, response: Response, next: NextFunction): void => {
  const token = getBearerToken(request);
  if (!token) {
    response.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing bearer token'
      }
    });
    return;
  }

  const claims = verifyToken(token);
  if (!claims) {
    response.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token'
      }
    });
    return;
  }

  response.locals.auth = claims;
  next();
};

export const requireAdmin = (request: Request, response: Response, next: NextFunction): void => {
  requireAuth(request, response, () => {
    const claims = response.locals.auth as AuthClaims | undefined;
    if (!claims || claims.role !== 'ADMIN') {
      response.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Admin role required'
        }
      });
      return;
    }

    next();
  });
};
