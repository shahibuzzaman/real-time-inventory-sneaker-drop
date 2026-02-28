import type { Server as IOServer } from 'socket.io';

export type SocketEvent = 'drop:updated' | 'drop:activity' | 'drop:created';

let ioServer: IOServer | null = null;

export const registerSocketServer = (io: IOServer): void => {
  ioServer = io;

  io.on('connection', (socket) => {
    socket.join('drops');
  });
};

export const emitToDropsRoom = (event: SocketEvent, payload: unknown): void => {
  ioServer?.to('drops').emit(event, payload);
};
