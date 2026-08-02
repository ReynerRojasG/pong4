import { randomBytes } from 'node:crypto';
import {
  MAX_PLAYERS,
  PLAYER_SIDES,
  ROOM_PHASES,
} from '../shared/protocol.js';

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_NAME_LENGTH = 24;

export class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
  }
}

export function generateRoomCode() {
  const bytes = randomBytes(ROOM_CODE_LENGTH);

  return Array.from(bytes, (byte) => (
    ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]
  )).join('');
}

export class RoomRegistry {
  constructor({ codeGenerator = generateRoomCode, now = Date.now } = {}) {
    this.codeGenerator = codeGenerator;
    this.now = now;
    this.rooms = new Map();
    this.socketRooms = new Map();
  }

  get size() {
    return this.rooms.size;
  }

  createRoom({ socketId, name }) {
    this.assertSocketAvailable(socketId);

    const playerName = this.normalizeName(name);
    const code = this.createAvailableCode();
    const player = this.createPlayer(socketId, playerName, 1);
    const room = {
      code,
      phase: ROOM_PHASES.LOBBY,
      version: 1,
      createdAt: this.now(),
      players: [player],
    };

    this.rooms.set(code, room);
    this.socketRooms.set(socketId, code);

    return {
      room: this.toSnapshot(room),
      player: { ...player },
    };
  }

  joinRoom({ socketId, code, name }) {
    this.assertSocketAvailable(socketId);

    const roomCode = this.normalizeRoomCode(code);
    const playerName = this.normalizeName(name);
    const room = this.rooms.get(roomCode);

    if (!room) {
      throw new RoomError('ROOM_NOT_FOUND', 'Room not found.');
    }

    if (room.players.length >= MAX_PLAYERS) {
      throw new RoomError('ROOM_FULL', 'Room is full.');
    }

    const slot = this.findAvailableSlot(room);
    const player = this.createPlayer(socketId, playerName, slot);

    room.players.push(player);
    room.players.sort((first, second) => first.slot - second.slot);
    room.phase = ROOM_PHASES.LOBBY;
    room.version += 1;
    this.socketRooms.set(socketId, roomCode);

    return {
      room: this.toSnapshot(room),
      player: { ...player },
    };
  }

  setReady({ socketId, ready }) {
    if (typeof ready !== 'boolean') {
      throw new RoomError('INVALID_READY', 'Ready must be a boolean.');
    }

    const room = this.getMutableRoomForSocket(socketId);
    const player = room.players.find((candidate) => candidate.id === socketId);

    if (!player) {
      throw new RoomError('PLAYER_NOT_FOUND', 'Player not found in room.');
    }

    const previousPhase = room.phase;
    const changed = player.ready !== ready;
    player.ready = ready;
    room.phase = this.calculatePhase(room);

    if (changed || room.phase !== previousPhase) {
      room.version += 1;
    }

    return {
      room: this.toSnapshot(room),
      becameReady: previousPhase !== ROOM_PHASES.READY
        && room.phase === ROOM_PHASES.READY,
    };
  }

  leaveRoom(socketId) {
    const code = this.socketRooms.get(socketId);

    if (!code) {
      return null;
    }

    const room = this.rooms.get(code);
    this.socketRooms.delete(socketId);

    if (!room) {
      return null;
    }

    const playerIndex = room.players.findIndex((player) => player.id === socketId);
    const [player] = playerIndex >= 0
      ? room.players.splice(playerIndex, 1)
      : [null];

    if (room.players.length === 0) {
      this.rooms.delete(code);

      return { room: null, roomCode: code, player };
    }

    room.phase = this.calculatePhase(room);
    room.version += 1;

    return {
      room: this.toSnapshot(room),
      roomCode: code,
      player,
    };
  }

  getRoomForSocket(socketId) {
    const code = this.socketRooms.get(socketId);
    const room = code ? this.rooms.get(code) : null;
    return room ? this.toSnapshot(room) : null;
  }

  getRoomSnapshot(code) {
    const room = this.rooms.get(this.normalizeRoomCode(code));
    return room ? this.toSnapshot(room) : null;
  }

  assertSocketAvailable(socketId) {
    if (typeof socketId !== 'string' || socketId.length === 0) {
      throw new RoomError('INVALID_PLAYER_ID', 'Player id is required.');
    }

    if (this.socketRooms.has(socketId)) {
      throw new RoomError('ALREADY_IN_ROOM', 'Player is already in a room.');
    }
  }

  createAvailableCode() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = this.normalizeRoomCode(this.codeGenerator());

      if (!this.rooms.has(code)) {
        return code;
      }
    }

    throw new RoomError('ROOM_CODE_UNAVAILABLE', 'Could not create a unique room code.');
  }

  createPlayer(id, name, slot) {
    return {
      id,
      name,
      slot,
      side: PLAYER_SIDES[slot - 1],
      ready: false,
    };
  }

  findAvailableSlot(room) {
    const occupiedSlots = new Set(room.players.map((player) => player.slot));

    for (let slot = 1; slot <= MAX_PLAYERS; slot += 1) {
      if (!occupiedSlots.has(slot)) {
        return slot;
      }
    }

    throw new RoomError('ROOM_FULL', 'Room is full.');
  }

  getMutableRoomForSocket(socketId) {
    const code = this.socketRooms.get(socketId);
    const room = code ? this.rooms.get(code) : null;

    if (!room) {
      throw new RoomError('PLAYER_NOT_FOUND', 'Player is not in a room.');
    }

    return room;
  }

  normalizeName(name) {
    if (typeof name !== 'string') {
      throw new RoomError('INVALID_NAME', 'Player name is required.');
    }

    const normalizedName = name.trim();

    if (normalizedName.length === 0 || normalizedName.length > MAX_NAME_LENGTH) {
      throw new RoomError(
        'INVALID_NAME',
        `Player name must contain between 1 and ${MAX_NAME_LENGTH} characters.`,
      );
    }

    return normalizedName;
  }

  normalizeRoomCode(code) {
    if (typeof code !== 'string') {
      throw new RoomError('INVALID_ROOM_CODE', 'Room code is required.');
    }

    const normalizedCode = code.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      throw new RoomError('INVALID_ROOM_CODE', 'Room code must contain 6 letters or numbers.');
    }

    return normalizedCode;
  }

  calculatePhase(room) {
    const allPlayersReady = room.players.length === MAX_PLAYERS
      && room.players.every((player) => player.ready);

    return allPlayersReady ? ROOM_PHASES.READY : ROOM_PHASES.LOBBY;
  }

  toSnapshot(room) {
    return {
      code: room.code,
      phase: room.phase,
      version: room.version,
      createdAt: room.createdAt,
      maxPlayers: MAX_PLAYERS,
      players: room.players.map((player) => ({ ...player })),
    };
  }
}
