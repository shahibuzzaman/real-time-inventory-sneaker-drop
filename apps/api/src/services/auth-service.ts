import { RefreshToken, User, UserRole, sequelize } from '@sneaker-drop/db';
import bcrypt from 'bcryptjs';
import crypto, { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Transaction } from 'sequelize';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';

type Role = 'ADMIN' | 'USER';
type PublicUser = { id: string; username: string; role: Role };
type AuthSession = { token: string; refreshToken: string; user: PublicUser };
const accessTokenExpiresIn = env.ACCESS_TOKEN_TTL as NonNullable<jwt.SignOptions['expiresIn']>;

const issueAccessToken = (user: User): string => {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      type: 'access'
    },
    env.JWT_SECRET,
    { expiresIn: accessTokenExpiresIn }
  );
};

const toPublicUser = (user: User): PublicUser => {
  return {
    id: user.id,
    username: user.username,
    role: user.role as Role
  };
};

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const issueRefreshToken = (userId: string): { token: string; tokenHash: string; expiresAt: Date } => {
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);
  const token = jwt.sign(
    {
      sub: userId,
      jti: randomUUID(),
      type: 'refresh'
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_TTL_SECONDS }
  );

  return {
    token,
    tokenHash: hashToken(token),
    expiresAt
  };
};

const issueSessionForUser = async (
  user: User,
  transaction?: Transaction
): Promise<{ session: AuthSession; refreshTokenRecord: RefreshToken }> => {
  const refresh = issueRefreshToken(user.id);
  const refreshTokenRecord = await RefreshToken.create(
    {
      userId: user.id,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
      revokedAt: null,
      replacedByTokenId: null
    },
    transaction ? { transaction } : undefined
  );

  return {
    session: {
      token: issueAccessToken(user),
      refreshToken: refresh.token,
      user: toPublicUser(user)
    },
    refreshTokenRecord
  };
};

export const registerUser = async (payload: {
  username: string;
  password: string;
}): Promise<AuthSession> => {
  const existing = await User.findOne({ where: { username: payload.username } });
  if (existing) {
    throw AppError.conflict('CONFLICT', 'Username already exists');
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);

  const user = await User.create({
    username: payload.username,
    passwordHash,
    role: UserRole.USER
  });

  const { session } = await issueSessionForUser(user);
  return session;
};

export const loginUser = async (payload: {
  username: string;
  password: string;
}): Promise<AuthSession> => {
  const user = await User.findOne({ where: { username: payload.username } });

  if (!user || !user.passwordHash) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');
  }

  const valid = await bcrypt.compare(payload.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');
  }

  const { session } = await issueSessionForUser(user);
  return session;
};

export const refreshAuthSession = async (refreshToken: string): Promise<AuthSession> => {
  let payload: { sub: string; type: 'refresh' };

  try {
    const verified = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      sub?: string;
      jti?: string;
      type?: 'refresh';
    };

    if (!verified.sub || !verified.jti || verified.type !== 'refresh') {
      throw new Error('Invalid refresh token payload');
    }

    payload = {
      sub: verified.sub,
      type: verified.type
    };
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid refresh token');
  }

  return sequelize.transaction(async (transaction) => {
    const tokenHash = hashToken(refreshToken);

    const existing = await RefreshToken.findOne({
      where: {
        userId: payload.sub,
        tokenHash
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!existing || existing.revokedAt || existing.expiresAt.getTime() <= Date.now()) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid refresh token');
    }

    const user = await User.findByPk(payload.sub, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid refresh token');
    }

    const { session, refreshTokenRecord } = await issueSessionForUser(user, transaction);

    await existing.update(
      {
        revokedAt: new Date(),
        replacedByTokenId: refreshTokenRecord.id
      },
      { transaction }
    );

    return session;
  });
};

export const logoutUser = async (refreshToken: string): Promise<void> => {
  const tokenHash = hashToken(refreshToken);
  await RefreshToken.update(
    { revokedAt: new Date() },
    {
      where: {
        tokenHash,
        revokedAt: null
      }
    }
  );
};

export const createLegacyUser = async (username: string): Promise<User> => {
  const passwordHash = await bcrypt.hash(`${username}-password`, 10);
  return User.create({ username, passwordHash, role: UserRole.USER });
};
