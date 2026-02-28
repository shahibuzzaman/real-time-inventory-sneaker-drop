import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import type { AuthUser, Drop } from '../types/api';
import { CreateDropPanel } from './create-drop-panel';
import { DropCard } from './drop-card';

type Props = {
  user: AuthUser;
  token: string;
  onSignOut: () => void;
};

type ReservationMap = Record<
  string,
  {
    reservationId: string;
    expiresAt: string;
  }
>;

const toDateTimeLocal = (isoDate: string): string => {
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

export const Dashboard = ({ user, token, onSignOut }: Props): JSX.Element => {
  const isAdmin = user.role === 'ADMIN';
  const queryClient = useQueryClient();
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [reservations, setReservations] = useState<ReservationMap>({});
  const [clock, setClock] = useState(() => Date.now());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [editingDropId, setEditingDropId] = useState<string | null>(null);
  const [confirmDeleteDropId, setConfirmDeleteDropId] = useState<string | null>(null);
  const [deletingDropId, setDeletingDropId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [priceCents, setPriceCents] = useState('');
  const [totalStock, setTotalStock] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({
    name: false,
    priceCents: false,
    totalStock: false,
    startsAt: false
  });

  const parsedPrice = Number.parseInt(priceCents, 10);
  const parsedStock = Number.parseInt(totalStock, 10);
  const startsAtDate = new Date(startsAt);

  const nameError = name.trim().length === 0 ? 'Drop name is required.' : null;
  const priceError =
    !Number.isInteger(parsedPrice) || parsedPrice <= 0
      ? 'Enter a positive whole number for price (cents).'
      : null;
  const stockError =
    !Number.isInteger(parsedStock) || parsedStock <= 0
      ? 'Enter a positive whole number for stock.'
      : null;
  const startsAtError = Number.isNaN(startsAtDate.getTime()) ? 'Select a valid start time.' : null;

  const showNameError = (submitAttempted || touched.name) && Boolean(nameError);
  const showPriceError = (submitAttempted || touched.priceCents) && Boolean(priceError);
  const showStockError = (submitAttempted || touched.totalStock) && Boolean(stockError);
  const showStartsAtError = (submitAttempted || touched.startsAt) && Boolean(startsAtError);

  const fieldClass = (hasError: boolean): string =>
    `rounded-xl border px-3 py-2 text-sm outline-none ${
      hasError ? 'border-red-500 focus:border-red-500' : 'border-slate-300 focus:border-accent'
    }`;

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (profileMenuRef.current && target && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileMenuOpen]);

  const dropsQuery = useQuery({
    queryKey: isAdmin ? ['admin-drops', token] : ['drops'],
    queryFn: () => (isAdmin ? api.getAdminDrops(token) : api.getActiveDrops()),
    refetchInterval: 10_000
  });

  const refreshDrops = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['drops'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-drops', token] });
  };

  const resetEditForm = (): void => {
    setName('');
    setPriceCents('');
    setTotalStock('');
    setStartsAt('');
    setSubmitAttempted(false);
    setTouched({
      name: false,
      priceCents: false,
      totalStock: false,
      startsAt: false
    });
  };

  const closeEditModal = (): void => {
    setEditingDropId(null);
    resetEditForm();
  };

  const openEditModal = (drop: Drop): void => {
    setEditingDropId(drop.id);
    setName(drop.name);
    setPriceCents(String(drop.priceCents));
    setTotalStock(String(drop.totalStock));
    setStartsAt(toDateTimeLocal(drop.startsAt));
    setSubmitAttempted(false);
    setTouched({
      name: false,
      priceCents: false,
      totalStock: false,
      startsAt: false
    });
  };

  const editingDrop = (dropsQuery.data ?? []).find((drop) => drop.id === editingDropId);
  const confirmingDeleteDrop = (dropsQuery.data ?? []).find((drop) => drop.id === confirmDeleteDropId);

  const reserveMutation = useMutation({
    mutationFn: ({ dropId }: { dropId: string }) => api.reserveDrop(dropId, token),
    onSuccess: (reservation) => {
      setReservations((prev) => ({
        ...prev,
        [reservation.dropId]: {
          reservationId: reservation.reservationId,
          expiresAt: reservation.expiresAt
        }
      }));
      queryClient.setQueryData<Drop[]>(['drops'], (current) => {
        if (!current) {
          return current;
        }

        return current.map((drop) =>
          drop.id === reservation.dropId
            ? { ...drop, availableStock: reservation.availableStock }
            : drop
        );
      });
      toast.success('Reservation confirmed. Complete checkout within 60 seconds.');
    },
    onError: (error) => {
      const typed = error as Error & { code?: string };
      toast.error(typed.code ? `${typed.code}: ${typed.message}` : typed.message);
    }
  });

  const purchaseMutation = useMutation({
    mutationFn: ({ dropId, reservationId }: { dropId: string; reservationId: string }) =>
      api.purchaseDrop(dropId, token, reservationId),
    onSuccess: (_result, variables) => {
      setReservations((prev) => {
        const copy = { ...prev };
        delete copy[variables.dropId];
        return copy;
      });
      toast.success('Purchase completed.');
      void queryClient.invalidateQueries({ queryKey: ['drops'] });
    },
    onError: (error, variables) => {
      const typed = error as Error & { code?: string };
      if (typed.code === 'EXPIRED') {
        setReservations((prev) => {
          const copy = { ...prev };
          delete copy[variables.dropId];
          return copy;
        });
      }

      toast.error(typed.code ? `${typed.code}: ${typed.message}` : typed.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: api.updateDrop,
    onSuccess: async () => {
      toast.success('Drop updated successfully.');
      closeEditModal();
      await refreshDrops();
    },
    onError: (error) => {
      const typed = error as Error & { code?: string };
      toast.error(typed.code ? `${typed.code}: ${typed.message}` : typed.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ dropId }: { dropId: string }) => api.deleteDrop(dropId, token),
    onMutate: ({ dropId }) => {
      setDeletingDropId(dropId);
    },
    onSuccess: async (_result, variables) => {
      toast.success('Drop deleted successfully.');
      if (editingDropId === variables.dropId) {
        closeEditModal();
      }
      if (confirmDeleteDropId === variables.dropId) {
        setConfirmDeleteDropId(null);
      }
      await refreshDrops();
    },
    onError: (error) => {
      const typed = error as Error & { code?: string };
      toast.error(typed.code ? `${typed.code}: ${typed.message}` : typed.message);
    },
    onSettled: () => {
      setDeletingDropId(null);
    }
  });

  useEffect(() => {
    const expiredDropIds = Object.entries(reservations)
      .filter(([, reservation]) => new Date(reservation.expiresAt).getTime() <= clock)
      .map(([dropId]) => dropId);

    if (expiredDropIds.length === 0) {
      return;
    }

    setReservations((prev) => {
      const copy = { ...prev };
      for (const dropId of expiredDropIds) {
        delete copy[dropId];
      }
      return copy;
    });
  }, [clock, reservations]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-ink">Inventory Dashboard</h1>
        </div>
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setProfileMenuOpen((current) => !current)}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
          >
            <span className="font-medium">{user.username}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
              {user.username.charAt(0).toUpperCase()}
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              className={`h-4 w-4 transition ${profileMenuOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <path d="M5 7.5 10 12.5l5-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {profileMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onSignOut();
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {user.role === 'ADMIN' && (
        <>
          <CreateDropPanel
            token={token}
            onCreated={() => {
              void refreshDrops();
            }}
          />
        </>
      )}

      {dropsQuery.isLoading && <p className="text-slate-700">Loading inventory...</p>}
      {dropsQuery.isError && <p className="text-red-600">Unable to load inventory.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {(dropsQuery.data ?? []).map((drop) => (
          isAdmin ? (
            <DropCard
              key={drop.id}
              mode="ADMIN"
              drop={drop}
              deleting={deleteMutation.isPending && deletingDropId === drop.id}
              onEdit={() => openEditModal(drop)}
              onDelete={() => setConfirmDeleteDropId(drop.id)}
            />
          ) : (
            <DropCard
              key={drop.id}
              mode="USER"
              drop={drop}
              reservation={reservations[drop.id]}
              reserving={reserveMutation.isPending && reserveMutation.variables?.dropId === drop.id}
              purchasing={
                purchaseMutation.isPending && purchaseMutation.variables?.dropId === drop.id
              }
              onReserve={() => reserveMutation.mutate({ dropId: drop.id })}
              onPurchase={(reservationId) =>
                purchaseMutation.mutate({
                  dropId: drop.id,
                  reservationId
                })
              }
              onExpired={() => {
                setReservations((prev) => {
                  const copy = { ...prev };
                  delete copy[drop.id];
                  return copy;
                });
              }}
            />
          )
        ))}
      </div>

      {isAdmin && editingDrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Edit Drop</h3>
                <p className="text-sm text-slate-600">Editing: {editingDrop.name}</p>
              </div>
              <button
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={closeEditModal}
              >
                Close
              </button>
            </div>

            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                setSubmitAttempted(true);
                if (nameError || priceError || stockError || startsAtError) {
                  return;
                }

                updateMutation.mutate({
                  dropId: editingDrop.id,
                  token,
                  name: name.trim(),
                  priceCents: parsedPrice,
                  totalStock: parsedStock,
                  startsAt: startsAtDate.toISOString()
                });
              }}
            >
              <div>
                <input
                  className={`w-full ${fieldClass(showNameError)}`}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setTouched((current) => ({ ...current, name: true }));
                  }}
                  onBlur={() => setTouched((current) => ({ ...current, name: true }))}
                  placeholder="Drop name"
                />
                {showNameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
              </div>

              <div>
                <input
                  className={`w-full ${fieldClass(showPriceError)}`}
                  value={priceCents}
                  type="number"
                  min={1}
                  step={1}
                  onChange={(event) => {
                    setPriceCents(event.target.value);
                    setTouched((current) => ({ ...current, priceCents: true }));
                  }}
                  onBlur={() => setTouched((current) => ({ ...current, priceCents: true }))}
                  placeholder="Price in cents"
                />
                {showPriceError && <p className="mt-1 text-xs text-red-600">{priceError}</p>}
              </div>

              <div>
                <input
                  className={`w-full ${fieldClass(showStockError)}`}
                  value={totalStock}
                  type="number"
                  min={1}
                  step={1}
                  onChange={(event) => {
                    setTotalStock(event.target.value);
                    setTouched((current) => ({ ...current, totalStock: true }));
                  }}
                  onBlur={() => setTouched((current) => ({ ...current, totalStock: true }))}
                  placeholder="Total inventory"
                />
                {showStockError && <p className="mt-1 text-xs text-red-600">{stockError}</p>}
              </div>

              <div>
                <input
                  className={`w-full ${fieldClass(showStartsAtError)}`}
                  value={startsAt}
                  type="datetime-local"
                  onChange={(event) => {
                    setStartsAt(event.target.value);
                    setTouched((current) => ({ ...current, startsAt: true }));
                  }}
                  onBlur={() => setTouched((current) => ({ ...current, startsAt: true }))}
                />
                {showStartsAtError && <p className="mt-1 text-xs text-red-600">{startsAtError}</p>}
              </div>

              <div className="mt-1 flex gap-2 md:col-span-2">
                <button
                  type="submit"
                  className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
                  onClick={closeEditModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin && confirmingDeleteDrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-ink">Delete Drop?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-ink">{confirmingDeleteDrop.name}</span>? This action
              cannot be undone.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setConfirmDeleteDropId(null)}
                disabled={deleteMutation.isPending && deletingDropId === confirmingDeleteDrop.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                onClick={() => deleteMutation.mutate({ dropId: confirmingDeleteDrop.id })}
                disabled={deleteMutation.isPending && deletingDropId === confirmingDeleteDrop.id}
              >
                {deleteMutation.isPending && deletingDropId === confirmingDeleteDrop.id
                  ? 'Deleting...'
                  : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
