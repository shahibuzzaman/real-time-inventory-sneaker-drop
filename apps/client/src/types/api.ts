export type Purchaser = {
  userId: string;
  username: string;
  createdAt: string;
};

export type UserRole = 'ADMIN' | 'USER';

export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type Drop = {
  id: string;
  name: string;
  priceCents: number;
  startsAt: string;
  totalStock: number;
  availableStock: number;
  latestPurchasers: Purchaser[];
};

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};
