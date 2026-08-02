import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { RoomRegistry } from './RoomRegistry.js';
import { registerSocketHandlers } from './registerSocketHandlers.js';

const DEFAULT_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
];

export function createApplicationServer({
  allowedOrigins = DEFAULT_ORIGINS,
  logger = console,
  roomRegistry = new RoomRegistry(),
} = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
  });

  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      rooms: roomRegistry.size,
    });
  });

  registerSocketHandlers({ io, roomRegistry, logger });

  const close = () => new Promise((resolve, reject) => {
    if (!httpServer.listening) {
      io.close();
      resolve();
      return;
    }

    io.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  return {
    app,
    httpServer,
    io,
    roomRegistry,
    close,
  };
}
