import { sequelize } from '@sneaker-drop/db';
import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import {
  createDrop,
  deleteDropById,
  getActiveDrops,
  getDropById,
  listAllDrops,
  purchaseDrop,
  reserveDrop,
  updateDropById
} from '../services/drop-service';
import { loginUser, logoutUser, refreshAuthSession, registerUser } from '../services/auth-service';
import { broadcastEvent } from '../utils/broadcast';
import {
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie
} from '../utils/refresh-cookie';

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(72)
});

const loginSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(72)
});

const createDropSchema = z.object({
  name: z.string().min(1).max(120),
  priceCents: z.number().int().positive(),
  totalStock: z.number().int().positive(),
  startsAt: z.string().datetime()
});

const updateDropSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    priceCents: z.number().int().positive().optional(),
    totalStock: z.number().int().positive().optional(),
    startsAt: z.string().datetime().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required'
  });

const dropIdSchema = z.object({
  dropId: z.string().uuid()
});

const purchaseSchema = z.object({
  reservationId: z.string().uuid()
});

export const apiRouter = Router();

apiRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  })
);

apiRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    await sequelize.query('SELECT 1', { type: QueryTypes.SELECT });
    res.json({ status: 'ready' });
  })
);

apiRouter.post(
  '/auth/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await registerUser({
      username: req.body.username,
      password: req.body.password
    });

    setRefreshTokenCookie(res, result.refreshToken);
    res.status(201).json({
      token: result.token,
      user: result.user
    });
  })
);

apiRouter.post(
  '/auth/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await loginUser({
      username: req.body.username,
      password: req.body.password
    });

    setRefreshTokenCookie(res, result.refreshToken);
    res.status(200).json({
      token: result.token,
      user: result.user
    });
  })
);

apiRouter.post(
  '/auth/refresh',
  asyncHandler(async (req, res) => {
    const refreshToken = readRefreshTokenCookie(req);
    if (!refreshToken) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing refresh token'
        }
      });
      return;
    }

    const result = await refreshAuthSession(refreshToken);
    setRefreshTokenCookie(res, result.refreshToken);
    res.status(200).json({
      token: result.token,
      user: result.user
    });
  })
);

apiRouter.post(
  '/auth/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = readRefreshTokenCookie(req);
    if (refreshToken) {
      await logoutUser(refreshToken);
    }

    clearRefreshTokenCookie(res);
    res.status(204).send();
  })
);

apiRouter.get(
  '/drops',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const drops = await listAllDrops();
    res.json({ drops });
  })
);

apiRouter.post(
  '/drops',
  requireAdmin,
  validateBody(createDropSchema),
  asyncHandler(async (req, res) => {
    const drop = await createDrop({
      name: req.body.name,
      priceCents: req.body.priceCents,
      totalStock: req.body.totalStock,
      startsAt: new Date(req.body.startsAt)
    });

    await broadcastEvent('drop:created', { drop });

    res.status(201).json({ drop });
  })
);

apiRouter.get(
  '/drops/active',
  asyncHandler(async (_req, res) => {
    const drops = await getActiveDrops();
    res.json({ drops });
  })
);

apiRouter.get(
  '/drops/:dropId',
  requireAdmin,
  validateParams(dropIdSchema),
  asyncHandler(async (req, res) => {
    const drop = await getDropById(req.params.dropId as string);
    res.json({ drop });
  })
);

apiRouter.patch(
  '/drops/:dropId',
  requireAdmin,
  validateParams(dropIdSchema),
  validateBody(updateDropSchema),
  asyncHandler(async (req, res) => {
    const dropId = req.params.dropId as string;
    const updatePayload: {
      name?: string;
      priceCents?: number;
      totalStock?: number;
      startsAt?: Date;
    } = {};

    if (req.body.name !== undefined) updatePayload.name = req.body.name;
    if (req.body.priceCents !== undefined) updatePayload.priceCents = req.body.priceCents;
    if (req.body.totalStock !== undefined) updatePayload.totalStock = req.body.totalStock;
    if (req.body.startsAt !== undefined) updatePayload.startsAt = new Date(req.body.startsAt);

    const drop = await updateDropById(dropId, {
      ...updatePayload
    });

    await broadcastEvent('drop:updated', { dropId, availableStock: drop.availableStock });
    await broadcastEvent('drop:activity', { dropId });

    res.json({ drop });
  })
);

apiRouter.delete(
  '/drops/:dropId',
  requireAdmin,
  validateParams(dropIdSchema),
  asyncHandler(async (req, res) => {
    const dropId = req.params.dropId as string;
    await deleteDropById(dropId);
    await broadcastEvent('drop:activity', { dropId });

    res.status(204).send();
  })
);

apiRouter.post(
  '/drops/:dropId/reserve',
  requireAuth,
  validateParams(dropIdSchema),
  asyncHandler(async (req, res) => {
    const auth = res.locals.auth as { userId: string };
    const dropId = req.params.dropId as string;
    const result = await reserveDrop(dropId, auth.userId);

    await broadcastEvent('drop:updated', {
      dropId: result.dropId,
      availableStock: result.availableStock
    });
    await broadcastEvent('drop:activity', { dropId: result.dropId });

    res.status(201).json({ reservation: result });
  })
);

apiRouter.post(
  '/drops/:dropId/purchase',
  requireAuth,
  validateParams(dropIdSchema),
  validateBody(purchaseSchema),
  asyncHandler(async (req, res) => {
    const auth = res.locals.auth as { userId: string };
    const dropId = req.params.dropId as string;
    const result = await purchaseDrop(dropId, auth.userId, req.body.reservationId);

    await broadcastEvent('drop:activity', { dropId });

    res.status(201).json({ purchase: result });
  })
);
