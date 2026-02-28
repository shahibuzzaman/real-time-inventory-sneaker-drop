import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';

const isProduction = env.NODE_ENV === 'production';

const getCookieOptions = (maxAgeMs?: number): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/api/auth',
  ...(maxAgeMs ? { maxAge: maxAgeMs } : {})
});

export const setRefreshTokenCookie = (response: Response, refreshToken: string): void => {
  response.cookie(
    env.REFRESH_TOKEN_COOKIE_NAME,
    refreshToken,
    getCookieOptions(env.REFRESH_TOKEN_TTL_SECONDS * 1000)
  );
};

export const clearRefreshTokenCookie = (response: Response): void => {
  response.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, getCookieOptions());
};

export const readRefreshTokenCookie = (request: Request): string | null => {
  const value = request.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME];
  if (!value || typeof value !== 'string') {
    return null;
  }
  return value;
};
