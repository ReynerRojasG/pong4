import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RoomError,
  RoomRegistry,
} from '../server/RoomRegistry.js';
import { ROOM_PHASES } from '../shared/protocol.js';

function createRegistry(code = 'ABC234') {
  let playerSequence = 0;
  let sessionSequence = 0;

  return new RoomRegistry({
    codeGenerator: () => code,
    playerIdGenerator: () => `player-${playerSequence += 1}`,
    sessionTokenGenerator: () => `session-${sessionSequence += 1}`,
    now: () => 123456789,
  });
}

test('creates a room with a stable player id assigned to the left side', () => {
  const registry = createRegistry();
  const result = registry.createRoom({ socketId: 'socket-1', name: 'PC1' });

  assert.equal(registry.size, 1);
  assert.equal(result.room.code, 'ABC234');
  assert.equal(result.room.phase, ROOM_PHASES.LOBBY);
  assert.equal(result.room.maxPlayers, 4);
  assert.equal(result.room.createdAt, 123456789);
  assert.deepEqual(result.player, {
    id: 'player-1',
    name: 'PC1',
    slot: 1,
    side: 'left',
    ready: false,
    connected: true,
  });
  assert.equal(result.sessionToken, 'session-1');
  assert.equal('sessionToken' in result.room.players[0], false);
});

test('assigns the four fixed sides and rejects a fifth player', () => {
  const registry = createRegistry();
  registry.createRoom({ socketId: 'socket-1', name: 'PC1' });
  registry.joinRoom({ socketId: 'socket-2', code: 'abc234', name: 'PC2' });
  registry.joinRoom({ socketId: 'socket-3', code: 'ABC234', name: 'PC3' });
  const result = registry.joinRoom({
    socketId: 'socket-4',
    code: 'ABC234',
    name: 'PC4',
  });

  assert.deepEqual(
    result.room.players.map(({ slot, side }) => ({ slot, side })),
    [
      { slot: 1, side: 'left' },
      { slot: 2, side: 'top' },
      { slot: 3, side: 'right' },
      { slot: 4, side: 'bottom' },
    ],
  );
  assert.throws(
    () => registry.joinRoom({
      socketId: 'socket-5',
      code: 'ABC234',
      name: 'PC5',
    }),
    (error) => error instanceof RoomError && error.code === 'ROOM_FULL',
  );
});

test('marks the match ready only when all four players are ready', () => {
  const registry = createRegistry();
  registry.createRoom({ socketId: 'socket-1', name: 'PC1' });
  registry.joinRoom({ socketId: 'socket-2', code: 'ABC234', name: 'PC2' });
  registry.joinRoom({ socketId: 'socket-3', code: 'ABC234', name: 'PC3' });
  registry.joinRoom({ socketId: 'socket-4', code: 'ABC234', name: 'PC4' });

  for (const socketId of ['socket-1', 'socket-2', 'socket-3']) {
    const result = registry.setReady({ socketId, ready: true });
    assert.equal(result.room.phase, ROOM_PHASES.LOBBY);
    assert.equal(result.becameReady, false);
  }

  const finalResult = registry.setReady({ socketId: 'socket-4', ready: true });
  assert.equal(finalResult.room.phase, ROOM_PHASES.READY);
  assert.equal(finalResult.becameReady, true);

  const repeatedResult = registry.setReady({ socketId: 'socket-4', ready: true });
  assert.equal(repeatedResult.becameReady, false);
});

test('reuses an available fixed slot and deletes empty rooms', () => {
  const registry = createRegistry();
  registry.createRoom({ socketId: 'socket-1', name: 'PC1' });
  registry.joinRoom({ socketId: 'socket-2', code: 'ABC234', name: 'PC2' });

  const firstLeave = registry.leaveRoom('socket-1');
  assert.equal(firstLeave.room.players.length, 1);

  const replacement = registry.joinRoom({
    socketId: 'socket-3',
    code: 'ABC234',
    name: 'PC3',
  });
  assert.equal(replacement.player.slot, 1);
  assert.equal(replacement.player.side, 'left');

  registry.leaveRoom('socket-2');
  const finalLeave = registry.leaveRoom('socket-3');
  assert.equal(finalLeave.room, null);
  assert.equal(registry.size, 0);
});

test('validates names, room codes, ready values and duplicate membership', () => {
  const registry = createRegistry();

  assert.throws(
    () => registry.createRoom({ socketId: 'socket-1', name: '   ' }),
    (error) => error.code === 'INVALID_NAME',
  );

  const normalized = registry.createRoom({
    socketId: 'socket-1',
    name: ' PC1\nPlayer ',
  });
  assert.equal(normalized.player.name, 'PC1 Player');

  assert.throws(
    () => registry.createRoom({ socketId: 'socket-1', name: 'PC1' }),
    (error) => error.code === 'ALREADY_IN_ROOM',
  );
  assert.throws(
    () => registry.joinRoom({ socketId: 'socket-2', code: '123', name: 'PC2' }),
    (error) => error.code === 'INVALID_ROOM_CODE',
  );
  assert.throws(
    () => registry.setReady({ socketId: 'socket-1', ready: 'yes' }),
    (error) => error.code === 'INVALID_READY',
  );
});

test('reconnects a player with the same id, name and side', () => {
  const registry = createRegistry();
  const created = registry.createRoom({ socketId: 'socket-1', name: 'Isaac' });
  const disconnected = registry.disconnectSocket('socket-1');

  assert.equal(disconnected.player.connected, false);
  assert.equal(disconnected.player.id, created.player.id);
  assert.equal(registry.getRoomForSocket('socket-1'), null);

  const reconnected = registry.reconnectPlayer({
    socketId: 'socket-2',
    sessionToken: created.sessionToken,
  });

  assert.deepEqual(reconnected.player, {
    ...created.player,
    connected: true,
  });
  assert.equal(reconnected.player.name, 'Isaac');
  assert.equal(reconnected.player.side, 'left');
  assert.equal(registry.getPlayerForSocket('socket-2').id, created.player.id);
  assert.equal(registry.removeDisconnectedPlayer(created.player.id), null);
});

test('removes a disconnected player only after explicit cleanup', () => {
  const registry = createRegistry();
  const created = registry.createRoom({ socketId: 'socket-1', name: 'Isaac' });

  registry.disconnectSocket('socket-1');
  assert.equal(registry.getRoomSnapshot('ABC234').players.length, 1);

  const removed = registry.removeDisconnectedPlayer(created.player.id);
  assert.equal(removed.room, null);
  assert.equal(registry.size, 0);
  assert.equal(registry.reconnectPlayer({
    socketId: 'socket-2',
    sessionToken: created.sessionToken,
  }), null);
});
