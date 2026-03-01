import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

type Props = {
  token: string;
  onCreated: () => void;
  inModal?: boolean;
};

const toDateTimeLocal = (date: Date): string => {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

export const CreateDropPanel = ({ token, onCreated, inModal = false }: Props): JSX.Element => {
  const defaultStartsAt = useMemo(() => toDateTimeLocal(new Date(Date.now() + 60_000)), []);
  const [name, setName] = useState('');
  const [priceCents, setPriceCents] = useState('19000');
  const [totalStock, setTotalStock] = useState('3');
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
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

  const createDropMutation = useMutation({
    mutationFn: api.createDrop,
    onSuccess: () => {
      toast.success('Drop created successfully.');
      setName('');
      setStartsAt(toDateTimeLocal(new Date(Date.now() + 60_000)));
      setSubmitAttempted(false);
      setTouched({
        name: false,
        priceCents: false,
        totalStock: false,
        startsAt: false
      });
      onCreated();
    },
    onError: (error) => {
      const typed = error as Error & { code?: string };
      toast.error(typed.code ? `${typed.code}: ${typed.message}` : typed.message);
    }
  });

  return (
    <section
      className={`${inModal ? '' : 'mb-6 '}rounded-2xl border border-sky-100 bg-white p-5 shadow-sm`}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">Create New Drop</h2>
        <p className="text-sm text-slate-600">Set pricing, inventory, and launch time.</p>
      </div>

      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitAttempted(true);
          if (nameError || priceError || stockError || startsAtError) {
            return;
          }

          createDropMutation.mutate({
            name: name.trim(),
            priceCents: parsedPrice,
            totalStock: parsedStock,
            startsAt: startsAtDate.toISOString(),
            token
          });
        }}
      >
        <div>
          <input
            className={`w-full ${fieldClass(showNameError)}`}
            placeholder="Drop name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setTouched((current) => ({ ...current, name: true }));
            }}
            onBlur={() => setTouched((current) => ({ ...current, name: true }))}
          />
          {showNameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
        </div>

        <div>
          <input
            className={`w-full ${fieldClass(showPriceError)}`}
            placeholder="Price in cents"
            type="number"
            min={1}
            step={1}
            value={priceCents}
            onChange={(event) => {
              setPriceCents(event.target.value);
              setTouched((current) => ({ ...current, priceCents: true }));
            }}
            onBlur={() => setTouched((current) => ({ ...current, priceCents: true }))}
          />
          {showPriceError && <p className="mt-1 text-xs text-red-600">{priceError}</p>}
        </div>

        <div>
          <input
            className={`w-full ${fieldClass(showStockError)}`}
            placeholder="Total inventory"
            type="number"
            min={1}
            step={1}
            value={totalStock}
            onChange={(event) => {
              setTotalStock(event.target.value);
              setTouched((current) => ({ ...current, totalStock: true }));
            }}
            onBlur={() => setTouched((current) => ({ ...current, totalStock: true }))}
          />
          {showStockError && <p className="mt-1 text-xs text-red-600">{stockError}</p>}
        </div>

        <div>
          <input
            className={`w-full ${fieldClass(showStartsAtError)}`}
            type="datetime-local"
            value={startsAt}
            onChange={(event) => {
              setStartsAt(event.target.value);
              setTouched((current) => ({ ...current, startsAt: true }));
            }}
            onBlur={() => setTouched((current) => ({ ...current, startsAt: true }))}
          />
          {showStartsAtError && <p className="mt-1 text-xs text-red-600">{startsAtError}</p>}
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={createDropMutation.isPending}
            className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {createDropMutation.isPending ? 'Saving...' : 'Create Drop'}
          </button>
        </div>
      </form>
    </section>
  );
};
