import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import type { AuthSession } from '../types/api';

type Props = {
  onAuthSuccess: (session: AuthSession) => void;
};

export const CreateUserForm = ({ onAuthSuccess }: Props): JSX.Element => {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({
    username: false,
    password: false
  });

  const usernameError =
    username.trim().length === 0
      ? 'Username is required.'
      : username.trim().length < 3
        ? 'Enter at least 3 characters.'
        : null;
  const passwordError =
    password.length === 0
      ? 'Password is required.'
      : password.length < 8
        ? 'Enter at least 8 characters.'
        : null;

  const showUsernameError = (submitAttempted || touched.username) && Boolean(usernameError);
  const showPasswordError = (submitAttempted || touched.password) && Boolean(passwordError);

  const fieldClass = (hasError: boolean): string =>
    `w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
      hasError
        ? 'border-red-500 focus:border-red-500'
        : 'border-slate-300 focus:border-accent'
    }`;

  const registerMutation = useMutation({
    mutationFn: api.register,
    onSuccess: (session) => {
      onAuthSuccess(session);
      toast.success(`Account created. Signed in as ${session.user.username}.`);
    },
    onError: (error) => {
      const typed = error as Error & { code?: string };
      toast.error(typed.code ? `${typed.code}: ${typed.message}` : typed.message);
    }
  });

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (session) => {
      onAuthSuccess(session);
      toast.success(`Welcome back, ${session.user.username}.`);
    },
    onError: (error) => {
      const typed = error as Error & { code?: string };
      toast.error(typed.code ? `${typed.code}: ${typed.message}` : typed.message);
    }
  });

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-sky-100 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-ink">Sneaker Drop Portal</h1>
      <p className="mt-2 text-sm text-slate-600">
        Sign in to continue. New accounts are created with USER access.
      </p>

      <div className="mt-6 flex rounded-xl border border-slate-300 p-1 text-sm">
        <button
          className={`flex-1 rounded-lg px-3 py-2 ${
            mode === 'register' ? 'bg-ink text-white' : 'text-slate-700'
          }`}
          onClick={() => {
            setMode('register');
            setSubmitAttempted(false);
          }}
          type="button"
        >
          Create Account
        </button>
        <button
          className={`flex-1 rounded-lg px-3 py-2 ${
            mode === 'login' ? 'bg-ink text-white' : 'text-slate-700'
          }`}
          onClick={() => {
            setMode('login');
            setSubmitAttempted(false);
          }}
          type="button"
        >
          Sign In
        </button>
      </div>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();

          setSubmitAttempted(true);
          if (usernameError || passwordError) {
            return;
          }

          if (mode === 'register') {
            registerMutation.mutate({
              username: username.trim(),
              password
            });
            return;
          }

          loginMutation.mutate({ username: username.trim(), password });
        }}
      >
        <div>
          <input
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setTouched((current) => ({ ...current, username: true }));
            }}
            onBlur={() => setTouched((current) => ({ ...current, username: true }))}
            placeholder="Username"
            className={fieldClass(showUsernameError)}
          />
          {showUsernameError && <p className="mt-1 text-xs text-red-600">{usernameError}</p>}
        </div>

        <div className="relative">
          <input
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setTouched((current) => ({ ...current, password: true }));
            }}
            onBlur={() => setTouched((current) => ({ ...current, password: true }))}
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            className={`${fieldClass(showPasswordError)} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
                <path
                  d="M3 3l18 18m-7.8-7.8A3 3 0 1 1 9.8 9.8M10.6 5.1A10.9 10.9 0 0 1 12 5c5.4 0 9.9 4.3 11 7-0.5 1.4-1.9 3.1-3.8 4.4M6.2 6.2C4.3 7.5 2.9 9.2 2.4 10.6A11.6 11.6 0 0 0 7.6 16"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
                <path
                  d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12Z"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" strokeWidth="1.8" />
              </svg>
            )}
          </button>
          {showPasswordError && <p className="mt-1 text-xs text-red-600">{passwordError}</p>}
        </div>

        <button
          type="submit"
          disabled={registerMutation.isPending || loginMutation.isPending}
          className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {registerMutation.isPending || loginMutation.isPending
            ? 'Processing...'
            : mode === 'register'
              ? 'Create Account'
              : 'Sign In'}
        </button>
      </form>
    </div>
  );
};
