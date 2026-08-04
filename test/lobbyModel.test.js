import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_PHASES } from '../shared/protocol.js';
import {
  buildLobbySlots,
  getLocalPlayer,
  isRoomReady,
  sanitizeRoomCode,
} from '../src/lobby/lobbyModel.js';

function createRoom(players, phase = ROOM_PHASES.LOBBY) {
  return {
    code: 'ABC234',
    phase,
    maxPlayers: 4,
    players,
  };
}

test('builds the four lobby slots in their fixed side order', () => {
  const room = createRoom([
    {
      id: 'player-1',
      name: 'Isaac',
      slot: 1,
      side: 'left',
      ready: true,
    },
    {
      id: 'player-3',
      name: 'Ana',
      slot: 3,
      side: 'right',
      ready: false,
    },
  ]);

  const slots = buildLobbySlots(room, 'player-3');

  assert.deepEqual(
    slots.map(({ slot, side, occupied, isLocal }) => ({
      slot,
      side,
      occupied,
      isLocal,
    })),
    [
      { slot: 1, side: 'left', occupied: true, isLocal: false },
      { slot: 2, side: 'top', occupied: false, isLocal: false },
      { slot: 3, side: 'right', occupied: true, isLocal: true },
      { slot: 4, side: 'bottom', occupied: false, isLocal: false },
    ],
  );
  assert.equal(getLocalPlayer(room, 'player-3').name, 'Ana');
  assert.equal(getLocalPlayer(room, 'missing-player'), null);
});

test('sanitizes room codes for the join form', () => {
  assert.equal(sanitizeRoomCode(' ab-c 234! '), 'ABC234');
  assert.equal(sanitizeRoomCode('room2468'), 'ROOM24');
  assert.equal(sanitizeRoomCode(null), '');
});

test('accepts ready only with four prepared players', () => {
  const readyPlayers = Array.from({ length: 4 }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `PC${index + 1}`,
    slot: index + 1,
    ready: true,
  }));

  assert.equal(isRoomReady(createRoom(readyPlayers)), false);
  assert.equal(
    isRoomReady(createRoom(readyPlayers, ROOM_PHASES.READY)),
    true,
  );

  readyPlayers[2].ready = false;
  assert.equal(
    isRoomReady(createRoom(readyPlayers, ROOM_PHASES.READY)),
    false,
  );
});
