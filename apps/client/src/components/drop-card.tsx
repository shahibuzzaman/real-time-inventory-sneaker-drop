import { useEffect } from 'react';
import type { Drop } from '../types/api';

type ReservationState = {
  reservationId: string;
  expiresAt: string;
};

type UserDropCardProps = {
  mode: 'USER';
  reservation: ReservationState | undefined;
  reserving: boolean;
  purchasing: boolean;
  onReserve: () => void;
  onPurchase: (reservationId: string) => void;
  onExpired: () => void;
};

type AdminDropCardProps = {
  mode: 'ADMIN';
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

type Props = {
  drop: Drop;
} & (UserDropCardProps | AdminDropCardProps);

const getSecondsRemaining = (expiresAt: string): number => {
  const expires = new Date(expiresAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((expires - now) / 1000));
};

export const DropCard = ({
  drop,
  ...props
}: Props): JSX.Element => {
  const reservation = props.mode === 'USER' ? props.reservation : undefined;
  const onExpired = props.mode === 'USER' ? props.onExpired : undefined;
  const latestPurchasers = drop.latestPurchasers ?? [];
  const secondsLeft = reservation ? getSecondsRemaining(reservation.expiresAt) : 0;

  useEffect(() => {
    if (onExpired && reservation && secondsLeft === 0) {
      onExpired();
    }
  }, [onExpired, reservation, secondsLeft]);

  const canPurchase = Boolean(reservation && secondsLeft > 0);

  return (
    <article className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{drop.name}</h3>
          <p className="text-sm text-slate-600">${(drop.priceCents / 100).toFixed(2)}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Starts at {new Date(drop.startsAt).toLocaleTimeString()}
        </span>
      </header>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Available Stock</p>
          <p className="text-4xl font-black text-ink">{drop.availableStock}</p>
        </div>
        <div className="flex gap-2">
          {props.mode === 'ADMIN' ? (
            <>
              <button
                onClick={props.onEdit}
                className="rounded-xl border border-ink px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
              >
                Edit
              </button>
              <button
                onClick={props.onDelete}
                disabled={props.deleting}
                className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {props.deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={props.onReserve}
                disabled={props.reserving || drop.availableStock <= 0}
                className="rounded-xl border border-ink px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {props.reserving ? 'Reserving...' : 'Reserve'}
              </button>
              <button
                onClick={() => reservation && props.onPurchase(reservation.reservationId)}
                disabled={!canPurchase || props.purchasing}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {props.purchasing
                  ? 'Purchasing...'
                  : canPurchase
                    ? `Purchase • ${secondsLeft}s`
                    : 'Purchase'}
              </button>
            </>
          )}
        </div>
      </div>

      <section className="mt-5 rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Purchases</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {latestPurchasers.length === 0 && <li>No purchases yet.</li>}
          {latestPurchasers.map((item) => (
            <li key={`${item.userId}-${item.createdAt}`} className="flex items-center justify-between">
              <span>{item.username}</span>
              <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
};
