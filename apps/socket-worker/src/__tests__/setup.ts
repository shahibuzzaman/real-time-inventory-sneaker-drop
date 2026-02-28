import { closeDb, connectDb, migrator, sequelize } from '@sneaker-drop/db';

beforeAll(async () => {
  await connectDb();
  await migrator.up();
});

beforeEach(async () => {
  await sequelize.query(
    'TRUNCATE TABLE "Purchases", "Reservations", "RefreshTokens", "Drops", "Users" RESTART IDENTITY CASCADE;'
  );
});

afterAll(async () => {
  await closeDb();
});
