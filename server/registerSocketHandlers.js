import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
} from '../shared/protocol.js';
import { RoomError } from './RoomRegistry.js';

function sendAcknowledgement(acknowledge, payload) {
  if (typeof acknowledge === 'function') {
    acknowledge(payload);
  }
}

function toErrorPayload(error, logger) {
  if (error instanceof RoomError) {
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

export function registerSocketHandlers({ io, roomRegistry, logger = console }) {
  io.on('connection', (socket) => {
    socket.emit(SERVER_EVENTS.CONNECTION_READY, { playerId: socket.id });

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
        io.to(createdRoomCode).emit(SERVER_EVENTS.ROOM_STATE, result.room);

        sendAcknowledgement(acknowledge, {
          ok: true,
          playerId: socket.id,
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
        io.to(joinedRoomCode).emit(SERVER_EVENTS.ROOM_STATE, result.room);

        sendAcknowledgement(acknowledge, {
          ok: true,
          playerId: socket.id,
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
          io.to(result.room.code).emit(SERVER_EVENTS.MATCH_READY, {
            room: result.room,
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

    socket.on(CLIENT_EVENTS.LEAVE_ROOM, async (_payload, acknowledge) => {
      try {
        const result = roomRegistry.leaveRoom(socket.id);

        if (result) {
          await socket.leave(result.roomCode);
          delete socket.data.roomCode;

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
      const result = roomRegistry.leaveRoom(socket.id);

      if (result?.room) {
        io.to(result.roomCode).emit(SERVER_EVENTS.ROOM_STATE, result.room);
      }
    });
  });
}
