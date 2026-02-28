import { Drop, Reservation, ReservationStatus, User, UserRole } from '@sneaker-drop/db';
import { runExpiryOnce } from '../services/expiry';

describe('runExpiryOnce', () => {
  it('marks expired reservations and restores stock', async () => {
    const user = await User.create({
      username: 'expiry-user',
      passwordHash: 'test-hash',
      role: UserRole.USER
    });
    const drop = await Drop.create({
      name: 'Test Drop',
      priceCents: 10000,
      totalStock: 1,
      availableStock: 0,
      startsAt: new Date(Date.now() - 60_000)
    });

    await Reservation.create({
      dropId: drop.id,
      userId: user.id,
      status: ReservationStatus.ACTIVE,
      expiresAt: new Date(Date.now() - 10_000)
    });

    const updates = await runExpiryOnce();
    expect(updates).toHaveLength(1);
    expect(updates[0]?.dropId).toBe(drop.id);

    const updatedDrop = await Drop.findByPk(drop.id);
    expect(updatedDrop?.availableStock).toBe(1);

    const reservation = await Reservation.findOne({ where: { dropId: drop.id, userId: user.id } });
    expect(reservation?.status).toBe(ReservationStatus.EXPIRED);
  });
});
