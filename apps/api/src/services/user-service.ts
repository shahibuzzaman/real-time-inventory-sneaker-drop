import { createLegacyUser } from './auth-service';

export const createUser = async (username: string) => {
  return createLegacyUser(username);
};
