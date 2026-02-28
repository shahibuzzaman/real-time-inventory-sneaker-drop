import { closeDb, connectDb } from '../sequelize';
import { migrator } from './migrator';

const run = async (): Promise<void> => {
  const command = process.argv[2] ?? 'up';
  await connectDb();

  if (command === 'up') {
    await migrator.up();
  } else if (command === 'down') {
    await migrator.down({ step: 1 });
  } else if (command === 'pending') {
    const pending = await migrator.pending();
    console.log(pending.map((item) => item.name));
  } else {
    throw new Error(`Unknown migration command: ${command}`);
  }

  await closeDb();
};

run().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
