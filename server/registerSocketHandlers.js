import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
} from '../shared/protocol.js';
import { MatchError } from './AuthoritativeMatch.js';
import { RoomError } from './RoomRegistry.js';

function sendAcknowledgement(acknowledge, payload) {
  if (typeof acknowledge === 'function') {
    acknowledge(payload);
  }
}

function toErrorPayload(error, logger) {
  if (error instanceof RoomError || error instanceof MatchError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  logger.error('Unexpected socket error:', error);

  return {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error.',
    },
  };
}

export function registerSocketHandlers({
  io,
  matchManager,
  roomRegistry,
  logger = console,
  disconnectGraceMs = 10000,
}) {
  const pendingDisconnects = new Map();

  function cancelPendingDisconnect(playerId) {
    const pending = pendingDisconnects.get(playerId);

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingDisconnects.delete(playerId);
  }

  function scheduleDisconnectedPlayerRemoval(result) {
    cancelPendingDisconnect(result.player.id);

    const timeout = setTimeout(() => {
      pendingDisconnects.delete(result.player.id);
      const leaveResult = roomRegistry.removeDisconnectedPlayer(result.player.id);

      if (!leaveResult) {
        return;
      }

      matchManager.endMatch(leaveResult.roomCode, 'reconnect-timeout');

      if (leaveResult.room) {
        io.to(leaveResult.roomCode).emit(SERVER_EVENTS.ROOM_STATE, leaveResult.room);
      }
    }, disconnectGraceMs);

    pendingDisconnects.set(result.player.id, {
      roomCode: result.roomCode,
      timeout,
    });
  }

  io.on('connection', (socket) => {
    const resumeResult = roomRegistry.reconnectPlayer({
      socketId: socket.id,
      sessionToken: socket.handshake.auth?.sessionToken,
    });

    if (resumeResult) {
      cancelPendingDisconnect(resumeResult.player.id);
      socket.data.roomCode = resumeResult.room.code;
      socket.data.playerId = resumeResult.player.id;
      Promise.resolve(socket.join(resumeResult.room.code)).then(() => {
        const activeRoom = roomRegistry.getRoomForSocket(socket.id);

        if (!socket.connected || activeRoom?.code !== resumeResult.room.code) {
          return;
        }

        socket.emit(SERVER_EVENTS.CONNECTION_READY, {
          playerId: resumeResult.player.id,
          resumed: true,
          room: resumeResult.room,
        });
        io.to(resumeResult.room.code).emit(SERVER_EVENTS.ROOM_STATE, resumeResult.room);

        const state = matchManager.getState(resumeResult.room.code);

        if (state) {
          socket.emit(SERVER_EVENTS.MATCH_READY, {
            room: resumeResult.room,
            state,
          });
        }
      }).catch((error) => logger.error('Could not restore socket room:', error));
    } else {
      socket.emit(SERVER_EVENTS.CONNECTION_READY, {
        playerId: socket.id,
        resumed: false,
      });
    }

    socket.on(CLIENT_EVENTS.CREATE_ROOM, async (payload, acknowledge) => {
      let createdRoomCode = null;

      try {
        const result = roomRegistry.createRoom({
          socketId: socket.id,
          name: payload?.name,
        });
        createdRoomCode = result.room.code;

        await socket.join(createdRoomCode);
        socket.data.roomCode = createdRoomCode;
        socket.data.playerId = result.player.id;
        io.to(createdRoomCode).emit(SERVER_EVENTS.ROOM_STATE, result.room);

        sendAcknowledgement(acknowledge, {
          ok: true,
          playerId: result.player.id,
          sessionToken: result.sessionToken,
          room: result.room,
        });
      } catch (error) {
        if (createdRoomCode) {
          roomRegistry.leaveRoom(socket.id);
        }

        sendAcknowledgement(acknowledge, toErrorPayload(error, logger));
      }
    });

    socket.on(CLIENT_EVENTS.JOIN_ROOM, async (payload, acknowledge) => {
      let joinedRoomCode = null;

      try {
        const result = roomRegistry.joinRoom({
          socketId: socket.id,
          code: payload?.code,
          name: payload?.name,
        });
        joinedRoomCode = result.room.code;

        await socket.join(joinedRoomCode);
        socket.data.roomCode = joinedRoomCode;
        socket.data.playerId = result.player.id;
        io.to(joinedRoomCode).emit(SERVER_EVENTS.ROOM_STATE, result.room);

        sendAcknowledgement(acknowledge, {
          ok: true,
          playerId: result.player.id,
          sessionToken: result.sessionToken,
          room: result.room,
        });
      } catch (error) {
        if (joinedRoomCode) {
          const leaveResult = roomRegistry.leaveRoom(socket.id);

          if (leaveResult?.room) {
            io.to(joinedRoomCode).emit(SERVER_EVENTS.ROOM_STATE, leaveResult.room);
          }
        }

        sendAcknowledgement(acknowledge, toErrorPayload(error, logger));
      }
    });

    socket.on(CLIENT_EVENTS.SET_READY, (payload, acknowledge) => {
      try {
        const result = roomRegistry.setReady({
          socketId: socket.id,
          ready: payload?.ready,
        });

        io.to(result.room.code).emit(SERVER_EVENTS.ROOM_STATE, result.room);

        if (result.becameReady) {
          const state = matchManager.startMatch(result.room);
          io.to(result.room.code).emit(SERVER_EVENTS.MATCH_READY, {
            room: result.room,
            state,
          });
        }

        sendAcknowledgement(acknowledge, {
          ok: true,
          room: result.room,
        });
      } catch (error) {
        sendAcknowledgement(acknowledge, toErrorPayload(error, logger));
      }
    });

    socket.on(CLIENT_EVENTS.PADDLE_INPUT, (payload) => {
      const receivedAt = Date.now();

      if (receivedAt - (socket.data.lastPaddleInputAt ?? 0) < 8) {
        return;
      }

      socket.data.lastPaddleInputAt = receivedAt;

      try {
        matchManager.setPaddleTarget(socket.id, payload);
      } catch (error) {
        const errorPayload = toErrorPayload(error, logger);
        socket.emit(SERVER_EVENTS.MATCH_ERROR, errorPayload.error);
      }
    });

    socket.on(CLIENT_EVENTS.LEAVE_ROOM, async (_payload, acknowledge) => {
      try {
        const activeRoomCode = socket.data.roomCode;
        const activePlayerId = socket.data.playerId;

        if (activeRoomCode) {
          matchManager.endMatch(activeRoomCode, 'player-left');
        }

        if (activePlayerId) {
          cancelPendingDisconnect(activePlayerId);
        }

        const result = roomRegistry.leaveRoom(socket.id);

        if (result) {
          await socket.leave(result.roomCode);
          delete socket.data.roomCode;
          delete socket.data.playerId;

          if (result.room) {
            io.to(result.roomCode).emit(SERVER_EVENTS.ROOM_STATE, result.room);
          }
        }

        sendAcknowledgement(acknowledge, { ok: true, room: null });
      } catch (error) {
        sendAcknowledgement(acknowledge, toErrorPayload(error, logger));
      }
    });

    socket.on('disconnect', () => {
      const result = roomRegistry.disconnectSocket(socket.id);

      if (result) {
        io.to(result.roomCode).emit(SERVER_EVENTS.ROOM_STATE, result.room);
        scheduleDisconnectedPlayerRemoval(result);
      }
    });
  });

  return () => {
    for (const pending of pendingDisconnects.values()) {
      clearTimeout(pending.timeout);
    }

    pendingDisconnects.clear();
  };
}
