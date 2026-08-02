import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RoomError,
  RoomRegistry,
} from '../server/RoomRegistry.js';
import { ROOM_PHASES } from '../shared/protocol.js';

function createRegistry(code = 'ABC234') {
  return new RoomRegistry({
    codeGenerator: () => code,
    now: () => 123456789,
  });
}

test('creates a room with PC1 assigned to the left side', () => {
  const registry = createRegistry();
  const result = registry.createRoom({ socketId: 'socket-1', name: 'PC1' });

  assert.equal(registry.size, 1);
  assert.equal(result.room.code, 'ABC234');
  assert.equal(result.room.phase, ROOM_PHASES.LOBBY);
  assert.equal(result.room.maxPlayers, 4);
  assert.equal(result.room.createdAt, 123456789);
  assert.deepEqual(result.player, {
    id: 'socket-1',
    name: 'PC1',
    slot: 1,
    side: 'left',
    ready: false,
  });
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

  registry.createRoom({ socketId: 'socket-1', name: ' PC1 ' });

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
