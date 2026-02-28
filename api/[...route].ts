import { connectDb } from '@sneaker-drop/db';
import type { Request, Response } from 'express';
import app from '../apps/api/src/app';

let dbReadyPromise: Promise<void> | null = null;

const ensureDbConnection = async (): Promise<void> => {
  if (!dbReadyPromise) {
    dbReadyPromise = connectDb();
  }

  await dbReadyPromise;
};

export default async function handler(req: Request, res: Response): Promise<void> {
  await ensureDbConnection();
  app(req, res);
}
