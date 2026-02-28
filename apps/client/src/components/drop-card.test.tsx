import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Drop } from '../types/api';
import { DropCard } from './drop-card';

const baseDrop: Drop = {
  id: 'drop-1',
  name: 'Retro Runner',
  priceCents: 19000,
  startsAt: new Date('2026-03-01T03:05:00.000Z').toISOString(),
  totalStock: 3,
  availableStock: 2,
  latestPurchasers: []
};

describe('DropCard', () => {
  it('fires admin edit and delete actions', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <DropCard
        mode="ADMIN"
        drop={baseDrop}
        deleting={false}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('handles missing latestPurchasers data without crashing', () => {
    const dropWithoutPurchasers = {
      ...baseDrop,
      latestPurchasers: undefined
    } as unknown as Drop;

    render(
      <DropCard
        mode="USER"
        drop={dropWithoutPurchasers}
        reservation={undefined}
        reserving={false}
        purchasing={false}
        onReserve={vi.fn()}
        onPurchase={vi.fn()}
        onExpired={vi.fn()}
      />
    );

    expect(screen.getByText('No purchases yet.')).toBeInTheDocument();
  });

  it('calls onExpired when reservation is no longer valid', async () => {
    const onExpired = vi.fn();

    render(
      <DropCard
        mode="USER"
        drop={baseDrop}
        reservation={{
          reservationId: 'reservation-1',
          expiresAt: new Date(Date.now() - 1_000).toISOString()
        }}
        reserving={false}
        purchasing={false}
        onReserve={vi.fn()}
        onPurchase={vi.fn()}
        onExpired={onExpired}
      />
    );

    await waitFor(() => {
      expect(onExpired).toHaveBeenCalledTimes(1);
    });
  });
});
