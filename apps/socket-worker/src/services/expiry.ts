import { ReservationStatus, sequelize } from '@sneaker-drop/db';
import { QueryTypes } from 'sequelize';
import { emitToDropsRoom } from '../socket';

export type ExpiryUpdate = {
  dropId: string;
  availableStock: number;
};

export const runExpiryOnce = async (): Promise<ExpiryUpdate[]> => {
  const updates: ExpiryUpdate[] = [];

  await sequelize.transaction(async (transaction) => {
    const expiredRows = await sequelize.query<{ dropId: string }>(
      `UPDATE "Reservations"
       SET status = :expiredStatus,
           "updatedAt" = NOW()
       WHERE status = :activeStatus
         AND "expiresAt" <= NOW()
       RETURNING "dropId";`,
      {
        replacements: {
          expiredStatus: ReservationStatus.EXPIRED,
          activeStatus: ReservationStatus.ACTIVE
        },
        transaction,
        type: QueryTypes.SELECT
      }
    );

    if (expiredRows.length === 0) {
      return;
    }

    const groupedByDrop = expiredRows.reduce<Map<string, number>>((acc, row) => {
      const current = acc.get(row.dropId) ?? 0;
      acc.set(row.dropId, current + 1);
      return acc;
    }, new Map());

    for (const [dropId, incrementBy] of groupedByDrop.entries()) {
      const stockRows = await sequelize.query<{ availableStock: number }>(
        `UPDATE "Drops"
         SET "availableStock" = "availableStock" + :incrementBy,
             "updatedAt" = NOW()
         WHERE id = :dropId
         RETURNING "availableStock";`,
        {
          replacements: { dropId, incrementBy },
          transaction,
          type: QueryTypes.SELECT
        }
      );

      const updated = stockRows[0];
      if (updated) {
        updates.push({
          dropId,
          availableStock: updated.availableStock
        });
      }
    }
  });

  for (const update of updates) {
    emitToDropsRoom('drop:updated', {
      dropId: update.dropId,
      availableStock: update.availableStock
    });
  }

  return updates;
};
