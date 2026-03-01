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

const formatStartLabel = (startsAt: string): string =>
  new Date(startsAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

export const DropCard = ({
  drop,
  ...props
}: Props): JSX.Element => {
  const reservation = props.mode === 'USER' ? props.reservation : undefined;
  const onExpired = props.mode === 'USER' ? props.onExpired : undefined;
  const latestPurchasers = drop.latestPurchasers ?? [];
  const secondsLeft = reservation ? getSecondsRemaining(reservation.expiresAt) : 0;
  const now = Date.now();
  const startsAtMs = new Date(drop.startsAt).getTime();
  const isSoldOut = drop.availableStock <= 0;
  const isUpcoming = startsAtMs > now;
  const hasActiveReservation = Boolean(reservation && secondsLeft > 0);

  useEffect(() => {
    if (onExpired && reservation && secondsLeft === 0) {
      onExpired();
    }
  }, [onExpired, reservation, secondsLeft]);

  const canPurchase = Boolean(reservation && secondsLeft > 0);
  const lifecycleStatus = isSoldOut
    ? {
        label: 'Sold Out',
        className: 'border-rose-200 bg-rose-50 text-rose-700'
      }
    : isUpcoming
      ? {
          label: 'Upcoming',
          className: 'border-amber-200 bg-amber-50 text-amber-700'
        }
      : {
          label: 'Live',
          className: 'border-emerald-200 bg-emerald-50 text-emerald-700'
        };

  return (
    <article className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-ink">{drop.name}</h3>
          <p className="text-sm text-slate-600">${(drop.priceCents / 100).toFixed(2)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${lifecycleStatus.className}`}
            >
              {lifecycleStatus.label}
            </span>
            {props.mode === 'USER' && hasActiveReservation && (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                Reserved by you
              </span>
            )}
          </div>
        </div>
        <span className="text-xs font-medium text-slate-500 sm:text-right">
          Starts {formatStartLabel(drop.startsAt)}
        </span>
      </header>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Available Stock</p>
          <p className="text-4xl font-black text-ink">{drop.availableStock}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {props.mode === 'ADMIN' ? (
            <>
              <button
                onClick={props.onEdit}
                className="w-full rounded-xl border border-ink px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white sm:w-auto"
              >
                Edit
              </button>
              <button
                onClick={props.onDelete}
                disabled={props.deleting}
                className="w-full rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                {props.deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={props.onReserve}
                disabled={props.reserving || drop.availableStock <= 0}
                className="w-full rounded-xl border border-ink px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                {props.reserving ? 'Reserving...' : 'Reserve'}
              </button>
              <button
                onClick={() => reservation && props.onPurchase(reservation.reservationId)}
                disabled={!canPurchase || props.purchasing}
                className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
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
