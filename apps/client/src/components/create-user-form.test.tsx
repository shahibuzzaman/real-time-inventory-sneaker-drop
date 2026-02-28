import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import type { AuthSession } from '../types/api';
import { CreateUserForm } from './create-user-form';

vi.mock('../lib/api', () => ({
  api: {
    register: vi.fn(),
    login: vi.fn()
  }
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const renderCreateUserForm = (onAuthSuccess = vi.fn()): void => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <CreateUserForm onAuthSuccess={onAuthSuccess} />
    </QueryClientProvider>
  );
};

describe('CreateUserForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows inline validation errors when submitted empty', async () => {
    const user = userEvent.setup();
    renderCreateUserForm();

    await user.click(screen.getByText('Create Account', { selector: 'button[type="submit"]' }));

    expect(screen.getByText('Username is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });

  it('toggles password visibility with the eye button', async () => {
    const user = userEvent.setup();
    renderCreateUserForm();

    const passwordInput = screen.getByPlaceholderText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('submits register and calls onAuthSuccess', async () => {
    const user = userEvent.setup();
    const onAuthSuccess = vi.fn();
    const session: AuthSession = {
      token: 'test-token',
      user: {
        id: 'user-1',
        username: 'new-user',
        role: 'USER'
      }
    };
    mockedApi.register.mockResolvedValueOnce(session);

    renderCreateUserForm(onAuthSuccess);

    await user.type(screen.getByPlaceholderText('Username'), '  new-user ');
    await user.type(screen.getByPlaceholderText('Password'), 'Password123!');
    await user.click(screen.getByText('Create Account', { selector: 'button[type="submit"]' }));

    await waitFor(() => {
      expect(mockedApi.register).toHaveBeenCalledTimes(1);
    });
    expect(mockedApi.register.mock.calls[0]?.[0]).toEqual({
      username: 'new-user',
      password: 'Password123!'
    });

    expect(onAuthSuccess).toHaveBeenCalledWith(session);
  });
});
