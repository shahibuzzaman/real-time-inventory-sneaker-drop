import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { CreateUserForm } from './components/create-user-form';
import { Dashboard } from './components/dashboard';
import { useSocketEvents } from './hooks/use-socket-events';
import { api } from './lib/api';
import type { AuthSession } from './types/api';

const SESSION_STORAGE_KEY = 'sneaker-drop-session';

const loadStoredSession = (): AuthSession | null => {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

function App(): JSX.Element {
  useSocketEvents();

  const [initialSession] = useState<AuthSession | null>(() => loadStoredSession());
  const [session, setSession] = useState<AuthSession | null>(initialSession);
  const [isInitializing, setIsInitializing] = useState<boolean>(initialSession === null);

  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      return;
    }

    localStorage.removeItem(SESSION_STORAGE_KEY);
  }, [session]);

  useEffect(() => {
    if (!isInitializing) {
      return;
    }

    let cancelled = false;
    const restoreSession = async (): Promise<void> => {
      try {
        const refreshed = await api.refresh();
        if (!cancelled) {
          setSession(refreshed);
        }
      } catch {
        if (!cancelled) {
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [isInitializing]);

  if (isInitializing) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-slate-600">Loading session...</div>;
  }

  return (
    <>
      {session ? (
        <Dashboard
          user={session.user}
          token={session.token}
          onSignOut={() => {
            void api.logout().catch(() => {
              // Local sign-out is still safe even if server revoke fails.
            });
            setSession(null);
          }}
        />
      ) : (
        <CreateUserForm onAuthSuccess={setSession} />
      )}
      <Toaster position="top-right" />
    </>
  );
}

export default App;
