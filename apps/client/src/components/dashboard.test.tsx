import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import type { AuthUser } from '../types/api';
import { Dashboard } from './dashboard';

vi.mock('../lib/api', () => ({
  api: {
    getAdminDrops: vi.fn(),
    getActiveDrops: vi.fn(),
    createDrop: vi.fn(),
    updateDrop: vi.fn(),
    deleteDrop: vi.fn(),
    reserveDrop: vi.fn(),
    purchaseDrop: vi.fn()
  }
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const adminUser: AuthUser = {
  id: 'admin-1',
  username: 'admin',
  role: 'ADMIN'
};

const renderDashboard = (props?: { onSignOut?: () => void }): void => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <Dashboard
        user={adminUser}
        token="test-token"
        onSignOut={props?.onSignOut ?? vi.fn()}
      />
    </QueryClientProvider>
  );
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getAdminDrops.mockResolvedValue([]);
    mockedApi.getActiveDrops.mockResolvedValue([]);
  });

  it('opens profile menu and signs out from dropdown action', async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    renderDashboard({ onSignOut });

    await user.click(screen.getByRole('button', { name: /admin/i }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
