import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchManager } from '../server/MatchManager.js';
import { MATCH_PHASES } from '../shared/matchConfig.js';

function createRoom() {
  return {
    code: 'ROOM24',
    players: ['left', 'top', 'right', 'bottom'].map((side, index) => ({
      id: `player-${index + 1}`,
      name: `Player ${index + 1}`,
      slot: index + 1,
      side,
    })),
  };
}

test('replaces the previous room loop and starts a fresh score state', () => {
  const io = {
    to: () => ({ emit: () => {} }),
  };
  const manager = new MatchManager({
    io,
    roomRegistry: {},
    now: () => 1000,
  });
  const room = createRoom();

  manager.startMatch(room);
  const previousMatch = manager.matches.get(room.code).match;
  previousMatch.players[0].score = 6;

  const nextSnapshot = manager.startMatch(room);

  assert.equal(previousMatch.phase, MATCH_PHASES.FINISHED);
  assert.deepEqual(nextSnapshot.players.map((player) => player.score), [0, 0, 0, 0]);
  assert.equal(manager.size, 1);

  manager.close();
  assert.equal(manager.size, 0);
});
