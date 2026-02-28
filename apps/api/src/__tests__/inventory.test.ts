import request from 'supertest';
import { Drop, Reservation, User, UserRole } from '@sneaker-drop/db';
import app from '../app';

const registerAndLogin = async (payload: {
  username: string;
  password: string;
  role?: 'ADMIN' | 'USER';
}): Promise<{ token: string; userId: string }> => {
  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send({
      username: payload.username,
      password: payload.password
    });

  if (registerResponse.status !== 201) {
    throw new Error(`Register failed with status ${registerResponse.status}`);
  }

  const userId = registerResponse.body.user.id as string;
  const registerToken = registerResponse.body.token as string;

  if (payload.role === 'ADMIN') {
    await User.update({ role: UserRole.ADMIN }, { where: { id: userId } });

    const loginResponse = await request(app).post('/api/auth/login').send({
      username: payload.username,
      password: payload.password
    });

    if (loginResponse.status !== 200) {
      throw new Error(`Login failed with status ${loginResponse.status}`);
    }

    return {
      token: loginResponse.body.token as string,
      userId
    };
  }

  return {
    token: registerToken,
    userId
  };
};

describe('Inventory critical flows', () => {
  it('rejects duplicate drop names', async () => {
    const admin = await registerAndLogin({
      username: 'admin-duplicate-name',
      password: 'Password123!',
      role: 'ADMIN'
    });

    const payload = {
      name: 'Same Name Drop',
      priceCents: 18000,
      totalStock: 5,
      startsAt: new Date(Date.now() - 60_000).toISOString()
    };

    await request(app).post('/api/drops').set('authorization', `Bearer ${admin.token}`).send(payload);

    const duplicate = await request(app)
      .post('/api/drops')
      .set('authorization', `Bearer ${admin.token}`)
      .send(payload);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DROP_NAME_EXISTS');
    expect(duplicate.body.error.message).toBe('Drop name already exists');
  });

  it('allows exactly one successful reservation under heavy concurrency', async () => {
    const admin = await registerAndLogin({
      username: 'admin-concurrency',
      password: 'Password123!',
      role: 'ADMIN'
    });
    const user = await registerAndLogin({
      username: 'concurrency-user',
      password: 'Password123!'
    });

    const dropResponse = await request(app)
      .post('/api/drops')
      .set('authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Limited Runner',
        priceCents: 19900,
        totalStock: 1,
        startsAt: new Date(Date.now() - 60_000).toISOString()
      });
    const dropId = dropResponse.body.drop.id as string;

    const reservations = await Promise.all(
      Array.from({ length: 50 }, () =>
        request(app)
          .post(`/api/drops/${dropId}/reserve`)
          .set('authorization', `Bearer ${user.token}`)
      )
    );

    const successCount = reservations.filter((response) => response.status === 201).length;
    const conflictCount = reservations.filter((response) => response.status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(49);
    for (const response of reservations.filter((item) => item.status === 409)) {
      expect(response.body.error.code).toBe('SOLD_OUT_OR_NOT_STARTED');
    }

    const drop = await Drop.findByPk(dropId);
    expect(drop?.availableStock).toBe(0);
  });

  it('enforces ownership, expiry, and double-purchase prevention', async () => {
    const admin = await registerAndLogin({
      username: 'admin-owner',
      password: 'Password123!',
      role: 'ADMIN'
    });
    const owner = await registerAndLogin({
      username: 'owner',
      password: 'Password123!'
    });
    const attacker = await registerAndLogin({
      username: 'attacker',
      password: 'Password123!'
    });

    const dropResponse = await request(app)
      .post('/api/drops')
      .set('authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Alpha Drop',
        priceCents: 25000,
        totalStock: 3,
        startsAt: new Date(Date.now() - 60_000).toISOString()
      });
    const dropId = dropResponse.body.drop.id as string;

    const reserveOne = await request(app)
      .post(`/api/drops/${dropId}/reserve`)
      .set('authorization', `Bearer ${owner.token}`);
    const firstReservationId = reserveOne.body.reservation.reservationId as string;

    const notOwnerPurchase = await request(app)
      .post(`/api/drops/${dropId}/purchase`)
      .set('authorization', `Bearer ${attacker.token}`)
      .send({ reservationId: firstReservationId });

    expect(notOwnerPurchase.status).toBe(403);
    expect(notOwnerPurchase.body.error.code).toBe('NOT_OWNER');

    await Reservation.update(
      {
        expiresAt: new Date(Date.now() - 5_000)
      },
      { where: { id: firstReservationId } }
    );

    const expiredPurchase = await request(app)
      .post(`/api/drops/${dropId}/purchase`)
      .set('authorization', `Bearer ${owner.token}`)
      .send({ reservationId: firstReservationId });

    expect(expiredPurchase.status).toBe(409);
    expect(expiredPurchase.body.error.code).toBe('EXPIRED');

    const reserveTwo = await request(app)
      .post(`/api/drops/${dropId}/reserve`)
      .set('authorization', `Bearer ${owner.token}`);
    const secondReservationId = reserveTwo.body.reservation.reservationId as string;

    const firstPurchase = await request(app)
      .post(`/api/drops/${dropId}/purchase`)
      .set('authorization', `Bearer ${owner.token}`)
      .send({ reservationId: secondReservationId });

    expect(firstPurchase.status).toBe(201);

    const doublePurchase = await request(app)
      .post(`/api/drops/${dropId}/purchase`)
      .set('authorization', `Bearer ${owner.token}`)
      .send({ reservationId: secondReservationId });

    expect(doublePurchase.status).toBe(409);
    expect(doublePurchase.body.error.code).toBe('NOT_ACTIVE');
  });
});
