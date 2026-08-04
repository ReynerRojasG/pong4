import { AuthoritativeMatch, MatchError } from './AuthoritativeMatch.js';
import { MATCH_CONFIG, MATCH_PHASES } from '../shared/matchConfig.js';
import { SERVER_EVENTS } from '../shared/protocol.js';

export class MatchManager {
  constructor({
    io,
    roomRegistry,
    now = Date.now,
    goalLogger = null,
    createMatch = (options) => new AuthoritativeMatch(options),
  }) {
    this.io = io;
    this.roomRegistry = roomRegistry;
    this.now = now;
    this.goalLogger = goalLogger;
    this.createMatch = createMatch;
    this.matches = new Map();
  }

  get size() {
    return this.matches.size;
  }

  startMatch(room) {
    this.endMatch(room.code, 'replaced', { emit: false });

    const match = this.createMatch({
      room,
      now: this.now,
      goalLogger: this.goalLogger,
    });
    const loop = {
      match,
      lastTickAt: this.now(),
      lastSnapshotAt: 0,
      interval: null,
    };
    const tickDelay = 1000 / MATCH_CONFIG.tickRate;

    loop.interval = setInterval(() => this.tick(room.code), tickDelay);
    this.matches.set(room.code, loop);

    const snapshot = match.getSnapshot();
    this.io.to(room.code).emit(SERVER_EVENTS.MATCH_STATE, snapshot);
    return snapshot;
  }

  setPaddleTarget(socketId, input) {
    const room = this.roomRegistry.getRoomForSocket(socketId);
    const player = this.roomRegistry.getPlayerForSocket(socketId);

    if (!room || !player) {
      throw new MatchError('MATCH_NOT_FOUND', 'Player is not in a room.');
    }

    const loop = this.matches.get(room.code);

    if (!loop) {
      throw new MatchError('MATCH_NOT_FOUND', 'Match is not active.');
    }

    loop.match.setPaddleTarget(player.id, input);
  }

  getState(roomCode) {
    const loop = this.matches.get(roomCode);
    return loop ? loop.match.getSnapshot() : null;
  }

  tick(roomCode) {
    const loop = this.matches.get(roomCode);

    if (!loop) {
      return;
    }

    const currentTime = this.now();
    const deltaMs = Math.max(1, Math.min(50, currentTime - loop.lastTickAt));
    loop.lastTickAt = currentTime;
    loop.match.step(deltaMs);

    const snapshotInterval = 1000 / MATCH_CONFIG.snapshotRate;
    const shouldBroadcast = currentTime - loop.lastSnapshotAt >= snapshotInterval
      || loop.match.phase === MATCH_PHASES.FINISHED;

    if (shouldBroadcast) {
      loop.lastSnapshotAt = currentTime;
      this.io.to(roomCode).emit(SERVER_EVENTS.MATCH_STATE, loop.match.getSnapshot());
    }

    if (loop.match.phase === MATCH_PHASES.FINISHED) {
      this.endMatch(roomCode, 'completed');
    }
  }

  endMatch(roomCode, reason, { emit = true } = {}) {
    const loop = this.matches.get(roomCode);

    if (!loop) {
      return null;
    }

    clearInterval(loop.interval);

    if (reason !== 'completed') {
      loop.match.finish();
    }

    const state = loop.match.getSnapshot();
    this.matches.delete(roomCode);

    if (emit) {
      this.io.to(roomCode).emit(SERVER_EVENTS.MATCH_ENDED, {
        reason,
        state,
      });
    }

    return state;
  }

  close() {
    for (const roomCode of [...this.matches.keys()]) {
      this.endMatch(roomCode, 'server-shutdown', { emit: false });
    }
  }
}
