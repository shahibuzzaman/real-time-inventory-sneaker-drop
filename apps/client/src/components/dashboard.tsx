import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
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

type AdminView = 'OVERVIEW' | 'INVENTORY';

const toDateTimeLocal = (isoDate: string): string => {
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
  );

const useDialogFocusTrap = ({
  dialogRef,
  enabled,
  onEscape
}: {
  dialogRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  onEscape: () => void;
}): void => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = getFocusableElements(dialog);
    (focusables[0] ?? dialog).focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const currentFocusables = getFocusableElements(dialog);
      if (currentFocusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first || document.activeElement === dialog) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [dialogRef, enabled, onEscape]);
};

const DropsSkeleton = (): JSX.Element => (
  <div className="grid gap-4 md:grid-cols-2">
    {Array.from({ length: 4 }).map((_, index) => (
      <article
        key={`skeleton-drop-${index}`}
        className="animate-pulse rounded-2xl border border-sky-100 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-5 w-28 rounded bg-slate-200" />
            <div className="h-4 w-16 rounded bg-slate-200" />
          </div>
          <div className="h-6 w-24 rounded-full bg-slate-200" />
        </div>
        <div className="mt-6 h-10 w-20 rounded bg-slate-200" />
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <div className="h-10 rounded-xl bg-slate-200" />
          <div className="h-10 rounded-xl bg-slate-200" />
        </div>
      </article>
    ))}
  </div>
);

export const Dashboard = ({ user, token, onSignOut }: Props): JSX.Element => {
  const isAdmin = user.role === 'ADMIN';
  const queryClient = useQueryClient();
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const createDialogRef = useRef<HTMLDivElement | null>(null);
  const editDialogRef = useRef<HTMLDivElement | null>(null);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  const [reservations, setReservations] = useState<ReservationMap>({});
  const [clock, setClock] = useState(() => Date.now());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeAdminView, setActiveAdminView] = useState<AdminView>('OVERVIEW');
  const [inventorySearch, setInventorySearch] = useState('');
  const [createDropModalOpen, setCreateDropModalOpen] = useState(false);
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

  useDialogFocusTrap({
    dialogRef: createDialogRef,
    enabled: Boolean(isAdmin && createDropModalOpen),
    onEscape: () => setCreateDropModalOpen(false)
  });
  useDialogFocusTrap({
    dialogRef: editDialogRef,
    enabled: Boolean(isAdmin && editingDrop),
    onEscape: closeEditModal
  });
  useDialogFocusTrap({
    dialogRef: deleteDialogRef,
    enabled: Boolean(isAdmin && confirmingDeleteDrop),
    onEscape: () => setConfirmDeleteDropId(null)
  });

  useEffect(() => {
    if (!createDropModalOpen && !editingDrop && !confirmingDeleteDrop) {
      return;
    }

    const currentOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = currentOverflow;
    };
  }, [createDropModalOpen, editingDrop, confirmingDeleteDrop]);

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

  const drops = dropsQuery.data ?? [];
  const kpis = useMemo(() => {
    const liveDrops = drops.filter(
      (drop) => drop.availableStock > 0 && new Date(drop.startsAt).getTime() <= clock
    ).length;
    const upcomingDrops = drops.filter((drop) => new Date(drop.startsAt).getTime() > clock).length;
    const totalAvailable = drops.reduce((sum, drop) => sum + drop.availableStock, 0);
    const activeReservations = Object.values(reservations).filter(
      (reservation) => new Date(reservation.expiresAt).getTime() > clock
    ).length;

    return [
      { label: 'Live Drops', value: liveDrops },
      { label: 'Upcoming', value: upcomingDrops },
      { label: 'Total Available', value: totalAvailable },
      { label: 'My Active Reservations', value: activeReservations }
    ];
  }, [clock, drops, reservations]);
  const adminMenuItems: Array<{ key: AdminView; label: string }> = [
    { key: 'OVERVIEW', label: 'Overview' },
    { key: 'INVENTORY', label: 'Inventory' }
  ];
  const filteredAdminDrops = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();
    if (query.length === 0) {
      return drops;
    }
    return drops.filter((drop) => drop.name.toLowerCase().includes(query));
  }, [drops, inventorySearch]);

  const profileMenu = (
    <div className="relative" ref={profileMenuRef}>
      <button
        type="button"
        onClick={() => setProfileMenuOpen((current) => !current)}
        className={
          isAdmin
            ? 'flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50'
            : 'flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50'
        }
        aria-haspopup="menu"
        aria-expanded={profileMenuOpen}
        aria-label={user.username}
      >
        {isAdmin ? (
          <>
            <span className="font-medium">{user.username}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {user.username.charAt(0).toUpperCase()}
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              className={`h-4 w-4 transition ${profileMenuOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <path
                d="M5 7.5 10 12.5l5-5"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        ) : (
          <>
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
              <path
                d="M5 7.5 10 12.5l5-5"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        )}
      </button>

      {profileMenuOpen && (
        <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {isAdmin && (
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {user.username}
            </p>
          )}
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
  );

  const inventoryErrorPanel = (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-rose-700">
      <h2 className="text-base font-semibold">Unable to load inventory</h2>
      <p className="mt-1 text-sm">Please try again. If this continues, check API availability.</p>
      <button
        type="button"
        onClick={() => {
          void dropsQuery.refetch();
        }}
        className="mt-4 rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
      >
        Retry
      </button>
    </section>
  );

  const adminOverviewContent = (
    <>
      <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-ink">{item.value}</p>
          </article>
        ))}
      </section>

      {dropsQuery.isLoading && <DropsSkeleton />}
      {dropsQuery.isError && inventoryErrorPanel}

      {!dropsQuery.isLoading && !dropsQuery.isError && (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Overview</h2>
          <p className="mt-2 text-sm text-slate-600">
            Use Inventory from the sidebar to search, create, edit, and delete drops.
          </p>
        </section>
      )}
    </>
  );

  const adminInventoryContent = (
    <>
      <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={inventorySearch}
          onChange={(event) => setInventorySearch(event.target.value)}
          placeholder="Search inventory by drop name"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 sm:max-w-sm"
          aria-label="Inventory search"
        />
        <button
          type="button"
          onClick={() => setCreateDropModalOpen(true)}
          className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Add New
        </button>
      </section>

      {dropsQuery.isLoading && <DropsSkeleton />}
      {dropsQuery.isError && inventoryErrorPanel}

      {!dropsQuery.isLoading && !dropsQuery.isError && filteredAdminDrops.length === 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-ink">
            {drops.length === 0 ? 'No inventory yet' : 'No matching drops'}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {drops.length === 0
              ? 'Click Add New to create your first drop.'
              : 'Try a different search term.'}
          </p>
        </section>
      )}

      {!dropsQuery.isLoading && !dropsQuery.isError && filteredAdminDrops.length > 0 && (
        <div className="space-y-4">
          {filteredAdminDrops.map((drop) => (
            <DropCard
              key={drop.id}
              mode="ADMIN"
              drop={drop}
              deleting={deleteMutation.isPending && deletingDropId === drop.id}
              onEdit={() => openEditModal(drop)}
              onDelete={() => setConfirmDeleteDropId(drop.id)}
            />
          ))}
        </div>
      )}
    </>
  );

  const userContent = (
    <>
      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-ink">{item.value}</p>
          </article>
        ))}
      </section>

      {dropsQuery.isLoading && <DropsSkeleton />}
      {dropsQuery.isError && inventoryErrorPanel}

      {!dropsQuery.isLoading && !dropsQuery.isError && drops.length === 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-ink">No drops available right now</h2>
          <p className="mt-2 text-sm text-slate-600">Check back soon for the next sneaker release.</p>
        </section>
      )}

      {!dropsQuery.isLoading && !dropsQuery.isError && drops.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {drops.map((drop) => (
            <DropCard
              key={drop.id}
              mode="USER"
              drop={drop}
              reservation={reservations[drop.id]}
              reserving={reserveMutation.isPending && reserveMutation.variables?.dropId === drop.id}
              purchasing={purchaseMutation.isPending && purchaseMutation.variables?.dropId === drop.id}
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
          ))}
        </div>
      )}
    </>
  );

  const content = isAdmin
    ? activeAdminView === 'INVENTORY'
      ? adminInventoryContent
      : adminOverviewContent
    : userContent;

  return (
    <div className={isAdmin ? 'min-h-screen bg-white' : ''}>
      {isAdmin ? (
        <div className="flex min-h-screen bg-slate-50">
          <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-5 md:block">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Admin</p>
            <nav className="mt-5 space-y-2">
              {adminMenuItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveAdminView(item.key)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                    activeAdminView === item.key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">
                    {activeAdminView === 'INVENTORY' ? 'Inventory' : 'Overview'}
                  </h1>
                </div>
                {profileMenu}
              </div>
            </header>

            <main className="flex-1 px-4 py-6 sm:px-6">
              <div className="mx-auto w-full max-w-6xl">{content}</div>
            </main>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-5xl px-4 py-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-black text-ink">Inventory Dashboard</h1>
            {profileMenu}
          </header>
          {content}
        </div>
      )}

      {isAdmin && createDropModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setCreateDropModalOpen(false);
            }
          }}
        >
          <div
            ref={createDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-drop-title"
            tabIndex={-1}
            className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="create-drop-title" className="text-lg font-semibold text-ink">
                Add New Drop
              </h3>
              <button
                type="button"
                onClick={() => setCreateDropModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <CreateDropPanel
              token={token}
              inModal
              onCreated={() => {
                setCreateDropModalOpen(false);
                void refreshDrops();
              }}
            />
          </div>
        </div>
      )}

      {isAdmin && editingDrop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditModal();
            }
          }}
        >
          <div
            ref={editDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-drop-title"
            tabIndex={-1}
            className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 id="edit-drop-title" className="text-lg font-semibold text-ink">
                  Edit Drop
                </h3>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmDeleteDropId(null);
            }
          }}
        >
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-drop-title"
            tabIndex={-1}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-xl"
          >
            <div className="border-b border-rose-200 bg-rose-50 px-5 py-4">
              <h3 id="delete-drop-title" className="text-lg font-semibold text-rose-700">
                Delete Drop Permanently
              </h3>
              <p className="mt-2 text-sm text-rose-700/80">
                You are deleting <span className="font-semibold">{confirmingDeleteDrop.name}</span>. This
                action cannot be undone.
              </p>
            </div>

            <form
              className="px-5 py-4"
              onSubmit={(event) => {
                event.preventDefault();
                deleteMutation.mutate({ dropId: confirmingDeleteDrop.id });
              }}
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setConfirmDeleteDropId(null)}
                  disabled={deleteMutation.isPending && deletingDropId === confirmingDeleteDrop.id}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  disabled={deleteMutation.isPending && deletingDropId === confirmingDeleteDrop.id}
                >
                  {deleteMutation.isPending && deletingDropId === confirmingDeleteDrop.id
                    ? 'Deleting...'
                    : 'Delete Forever'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
