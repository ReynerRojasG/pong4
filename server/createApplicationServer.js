import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { MatchManager } from './MatchManager.js';
import { RoomRegistry } from './RoomRegistry.js';
import { registerSocketHandlers } from './registerSocketHandlers.js';

const DEFAULT_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
];
const DEFAULT_CLIENT_DIST_PATH = fileURLToPath(new URL('../dist', import.meta.url));
const DEFAULT_DISCONNECT_GRACE_MS = 10000;
const DEFAULT_GOAL_LOGS_ENABLED = process.env.PONG_GOAL_LOGS === '1'
  || (
    process.env.PONG_GOAL_LOGS !== '0'
    && process.env.NODE_ENV !== 'production'
  );

export function createApplicationServer({
  allowedOrigins = DEFAULT_ORIGINS,
  clientDistPath = DEFAULT_CLIENT_DIST_PATH,
  logger = console,
  roomRegistry = new RoomRegistry(),
  disconnectGraceMs = DEFAULT_DISCONNECT_GRACE_MS,
  goalLogsEnabled = DEFAULT_GOAL_LOGS_ENABLED,
} = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: disconnectGraceMs,
      skipMiddlewares: true,
    },
  });
  const goalLogger = goalLogsEnabled
    ? (message) => logger.info?.(message)
    : null;
  const matchManager = new MatchManager({ io, roomRegistry, goalLogger });

  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      rooms: roomRegistry.size,
      matches: matchManager.size,
    });
  });

  const clientIndexPath = join(clientDistPath, 'index.html');

  if (existsSync(clientIndexPath)) {
    app.use(express.static(clientDistPath, {
      index: false,
      maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    }));
    app.get(/^(?!\/health(?:\/|$)|\/socket\.io(?:\/|$)).*/, (_request, response) => {
      response.sendFile(clientIndexPath);
    });
  }

  const cleanupSocketHandlers = registerSocketHandlers({
    io,
    matchManager,
    roomRegistry,
    logger,
    disconnectGraceMs,
  });

  const close = () => new Promise((resolve, reject) => {
    cleanupSocketHandlers();
    matchManager.close();

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
    matchManager,
    roomRegistry,
    close,
  };
}
