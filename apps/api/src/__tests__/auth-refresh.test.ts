import request from 'supertest';
import app from '../app';
import { env } from '../config/env';

const extractRefreshCookie = (response: request.Response): string => {
  const cookies = response.headers['set-cookie'] as string[] | undefined;
  const refreshCookie = cookies?.find((cookie) =>
    cookie.startsWith(`${env.REFRESH_TOKEN_COOKIE_NAME}=`)
  );
  if (!refreshCookie) {
    throw new Error('Missing refresh cookie');
  }

  return refreshCookie.split(';')[0] ?? '';
};

describe('Auth refresh flow', () => {
  it('rotates refresh tokens and rejects reused/revoked tokens', async () => {
    const registerResponse = await request(app).post('/api/auth/register').send({
      username: 'refresh-user',
      password: 'Password123!'
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.token).toBeDefined();

    const firstCookie = extractRefreshCookie(registerResponse);

    const refreshResponse = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.token).toBeDefined();

    const secondCookie = extractRefreshCookie(refreshResponse);
    expect(secondCookie).not.toBe(firstCookie);

    const reusedOldTokenResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie);
    expect(reusedOldTokenResponse.status).toBe(401);
    expect(reusedOldTokenResponse.body.error.code).toBe('UNAUTHORIZED');

    const logoutResponse = await request(app).post('/api/auth/logout').set('Cookie', secondCookie);
    expect(logoutResponse.status).toBe(204);

    const refreshAfterLogoutResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', secondCookie);
    expect(refreshAfterLogoutResponse.status).toBe(401);
  });
});
