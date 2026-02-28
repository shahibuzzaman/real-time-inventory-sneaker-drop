import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import type { Drop } from '../types/api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3002';

export const useSocketEvents = (): void => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('drop:updated', (payload: { dropId: string; availableStock: number }) => {
      queryClient.setQueryData<Drop[]>(['drops'], (current) => {
        if (!current) {
          return current;
        }

        return current.map((drop) =>
          drop.id === payload.dropId ? { ...drop, availableStock: payload.availableStock } : drop
        );
      });
    });

    socket.on('drop:activity', () => {
      void queryClient.invalidateQueries({ queryKey: ['drops'] });
    });

    socket.on('drop:created', () => {
      void queryClient.invalidateQueries({ queryKey: ['drops'] });
    });

    return () => {
      socket.close();
    };
  }, [queryClient]);
};
