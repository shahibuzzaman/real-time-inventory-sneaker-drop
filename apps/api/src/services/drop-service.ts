import {
  Drop,
  Purchase,
  Reservation,
  ReservationStatus,
  User,
  sequelize
} from '@sneaker-drop/db';
import { QueryTypes } from 'sequelize';
import { AppError } from '../errors/app-error';

const RESERVATION_TTL_MS = 60_000;

type ActiveDropRow = {
  id: string;
  name: string;
  priceCents: number;
  startsAt: Date;
  totalStock: number;
  availableStock: number;
  createdAt: Date;
  updatedAt: Date;
  latestPurchasers: Array<{
    userId: string;
    username: string;
    createdAt: string;
  }>;
};

export const createDrop = async (payload: {
  name: string;
  priceCents: number;
  totalStock: number;
  startsAt: Date;
}): Promise<Drop> => {
  return Drop.create({
    ...payload,
    availableStock: payload.totalStock
  });
};

export const listAllDrops = async (): Promise<Drop[]> => {
  return Drop.findAll({
    order: [['startsAt', 'DESC']]
  });
};

export const getDropById = async (dropId: string): Promise<Drop> => {
  const drop = await Drop.findByPk(dropId);
  if (!drop) {
    throw AppError.notFound('NOT_FOUND', 'Drop not found');
  }
  return drop;
};

export const updateDropById = async (
  dropId: string,
  payload: {
    name?: string;
    priceCents?: number;
    totalStock?: number;
    startsAt?: Date;
  }
): Promise<Drop> => {
  const drop = await getDropById(dropId);

  const soldOrReserved = drop.totalStock - drop.availableStock;
  const nextTotalStock = payload.totalStock ?? drop.totalStock;

  if (nextTotalStock < soldOrReserved) {
    throw AppError.conflict(
      'NOT_ACTIVE',
      'Cannot set total stock below already sold/reserved quantity'
    );
  }

  const nextAvailableStock = nextTotalStock - soldOrReserved;

  await drop.update({
    name: payload.name ?? drop.name,
    priceCents: payload.priceCents ?? drop.priceCents,
    startsAt: payload.startsAt ?? drop.startsAt,
    totalStock: nextTotalStock,
    availableStock: nextAvailableStock
  });

  return drop;
};

export const deleteDropById = async (dropId: string): Promise<void> => {
  const removed = await Drop.destroy({ where: { id: dropId } });
  if (!removed) {
    throw AppError.notFound('NOT_FOUND', 'Drop not found');
  }
};

export const getActiveDrops = async (): Promise<ActiveDropRow[]> => {
  const rows = await sequelize.query<ActiveDropRow>(
    `WITH ranked_purchases AS (
      SELECT
        p."dropId",
        u.id AS "userId",
        u.username,
        p."createdAt",
        ROW_NUMBER() OVER (PARTITION BY p."dropId" ORDER BY p."createdAt" DESC) AS rn
      FROM "Purchases" p
      INNER JOIN "Users" u ON u.id = p."userId"
    )
    SELECT
      d.id,
      d.name,
      d."priceCents",
      d."startsAt",
      d."totalStock",
      d."availableStock",
      d."createdAt",
      d."updatedAt",
      COALESCE(
        json_agg(
          json_build_object(
            'userId', rp."userId",
            'username', rp.username,
            'createdAt', rp."createdAt"
          )
          ORDER BY rp."createdAt" DESC
        ) FILTER (WHERE rp.rn IS NOT NULL),
        '[]'::json
      ) AS "latestPurchasers"
    FROM "Drops" d
    LEFT JOIN ranked_purchases rp ON rp."dropId" = d.id AND rp.rn <= 3
    WHERE d."startsAt" <= NOW()
    GROUP BY d.id
    ORDER BY d."startsAt" ASC`,
    {
      type: QueryTypes.SELECT
    }
  );

  return rows;
};

export const reserveDrop = async (
  dropId: string,
  userId: string
): Promise<{
  reservationId: string;
  dropId: string;
  availableStock: number;
  expiresAt: Date;
}> => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw AppError.notFound('NOT_FOUND', 'User not found');
  }

  return sequelize.transaction(async (transaction) => {
    const updatedRows = await sequelize.query<{ id: string; availableStock: number }>(
      `UPDATE "Drops"
       SET "availableStock" = "availableStock" - 1
       WHERE id = :dropId
         AND "availableStock" > 0
         AND "startsAt" <= NOW()
       RETURNING id, "availableStock";`,
      {
        replacements: { dropId },
        transaction,
        type: QueryTypes.SELECT
      }
    );

    const updatedDrop = updatedRows[0];
    if (!updatedDrop) {
      throw AppError.conflict('SOLD_OUT_OR_NOT_STARTED', 'Drop is sold out or not started');
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
    const reservation = await Reservation.create(
      {
        dropId,
        userId,
        status: ReservationStatus.ACTIVE,
        expiresAt
      },
      { transaction }
    );

    return {
      reservationId: reservation.id,
      dropId,
      availableStock: updatedDrop.availableStock,
      expiresAt
    };
  });
};

export const purchaseDrop = async (
  dropId: string,
  userId: string,
  reservationId: string
): Promise<{ purchaseId: string }> => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw AppError.notFound('NOT_FOUND', 'User not found');
  }

  return sequelize.transaction(async (transaction) => {
    const reservation = await Reservation.findOne({
      where: { id: reservationId, dropId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!reservation) {
      throw AppError.notFound('NOT_FOUND', 'Reservation not found');
    }

    if (reservation.userId !== userId) {
      throw AppError.forbidden('NOT_OWNER', 'Reservation belongs to another user');
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      if (reservation.status === ReservationStatus.EXPIRED) {
        throw AppError.conflict('EXPIRED', 'Reservation expired');
      }

      throw AppError.conflict('NOT_ACTIVE', 'Reservation is not active');
    }

    if (reservation.expiresAt.getTime() <= Date.now()) {
      throw AppError.conflict('EXPIRED', 'Reservation expired');
    }

    const existingPurchase = await Purchase.findOne({
      where: { reservationId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (existingPurchase) {
      throw AppError.conflict('NOT_ACTIVE', 'Reservation already purchased');
    }

    const purchase = await Purchase.create(
      {
        dropId,
        userId,
        reservationId
      },
      { transaction }
    );

    await reservation.update(
      {
        status: ReservationStatus.PURCHASED
      },
      { transaction }
    );

    return { purchaseId: purchase.id };
  });
};
