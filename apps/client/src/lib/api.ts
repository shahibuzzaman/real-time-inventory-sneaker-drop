import type { ApiError, AuthSession, Drop } from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const parseError = async (response: Response): Promise<never> => {
  let errorPayload: ApiError | null = null;
  try {
    errorPayload = (await response.json()) as ApiError;
  } catch {
    errorPayload = null;
  }

  const error = new Error(errorPayload?.error.message ?? 'Request failed');
  const typedError = error as Error & { code?: string };
  if (errorPayload?.error.code) {
    typedError.code = errorPayload.error.code;
  }
  throw error;
};

const authHeaders = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`
});

export const api = {
  async register(payload: {
    username: string;
    password: string;
  }): Promise<AuthSession> {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: payload.username,
        password: payload.password
      })
    });

    if (!response.ok) {
      await parseError(response);
    }

    return (await response.json()) as AuthSession;
  },

  async login(payload: { username: string; password: string }): Promise<AuthSession> {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      await parseError(response);
    }

    return (await response.json()) as AuthSession;
  },

  async refresh(): Promise<AuthSession> {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      await parseError(response);
    }

    return (await response.json()) as AuthSession;
  },

  async logout(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      await parseError(response);
    }
  },

  async createDrop(payload: {
    name: string;
    priceCents: number;
    totalStock: number;
    startsAt: string;
    token: string;
  }): Promise<Drop> {
    const response = await fetch(`${API_BASE}/api/drops`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(payload.token)
      },
      body: JSON.stringify({
        name: payload.name,
        priceCents: payload.priceCents,
        totalStock: payload.totalStock,
        startsAt: payload.startsAt
      })
    });

    if (!response.ok) {
      await parseError(response);
    }

    const json = (await response.json()) as { drop: Drop };
    return json.drop;
  },

  async getAdminDrops(token: string): Promise<Drop[]> {
    const response = await fetch(`${API_BASE}/api/drops`, {
      credentials: 'include',
      headers: authHeaders(token)
    });

    if (!response.ok) {
      await parseError(response);
    }

    const payload = (await response.json()) as { drops: Drop[] };
    return payload.drops.map((drop) => ({
      ...drop,
      latestPurchasers: drop.latestPurchasers ?? []
    }));
  },

  async updateDrop(payload: {
    dropId: string;
    token: string;
    name?: string;
    priceCents?: number;
    totalStock?: number;
    startsAt?: string;
  }): Promise<Drop> {
    const body: {
      name?: string;
      priceCents?: number;
      totalStock?: number;
      startsAt?: string;
    } = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.priceCents !== undefined) body.priceCents = payload.priceCents;
    if (payload.totalStock !== undefined) body.totalStock = payload.totalStock;
    if (payload.startsAt !== undefined) body.startsAt = payload.startsAt;

    const response = await fetch(`${API_BASE}/api/drops/${payload.dropId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(payload.token)
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      await parseError(response);
    }

    const json = (await response.json()) as { drop: Drop };
    return json.drop;
  },

  async deleteDrop(dropId: string, token: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/drops/${dropId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: authHeaders(token)
    });

    if (!response.ok) {
      await parseError(response);
    }
  },

  async getActiveDrops(): Promise<Drop[]> {
    const response = await fetch(`${API_BASE}/api/drops/active`, {
      credentials: 'include'
    });
    if (!response.ok) {
      await parseError(response);
    }

    const payload = (await response.json()) as { drops: Drop[] };
    return payload.drops;
  },

  async reserveDrop(
    dropId: string,
    token: string
  ): Promise<{
    reservationId: string;
    dropId: string;
    availableStock: number;
    expiresAt: string;
  }> {
    const response = await fetch(`${API_BASE}/api/drops/${dropId}/reserve`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...authHeaders(token)
      }
    });

    if (!response.ok) {
      await parseError(response);
    }

    const payload = (await response.json()) as {
      reservation: {
        reservationId: string;
        dropId: string;
        availableStock: number;
        expiresAt: string;
      };
    };

    return payload.reservation;
  },

  async purchaseDrop(dropId: string, token: string, reservationId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/drops/${dropId}/purchase`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(token)
      },
      body: JSON.stringify({ reservationId })
    });

    if (!response.ok) {
      await parseError(response);
    }
  }
};
