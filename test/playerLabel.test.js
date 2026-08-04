import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPlayerScoreLabel,
  getPlayerDisplayName,
} from '../src/scenes/playerLabel.js';

test('renders the real player name with the official score', () => {
  assert.equal(
    formatPlayerScoreLabel({ name: 'Isaac', slot: 1, score: 3 }),
    'Isaac  3',
  );
  assert.equal(
    formatPlayerScoreLabel({ name: 'Reyner', slot: 2, score: 1 }),
    'Reyner  1',
  );
});

test('uses a temporary slot fallback only when the name is missing', () => {
  assert.equal(formatPlayerScoreLabel({ name: '', slot: 3, score: 5 }), 'PC3  5');
  assert.equal(formatPlayerScoreLabel({ slot: 4, score: 2 }), 'PC4  2');
});

test('keeps markup-like names as plain display text', () => {
  assert.equal(
    formatPlayerScoreLabel({ name: '<b>Isaac</b>', slot: 1, score: 2 }),
    '<b>Isaac</b>  2',
  );
});

test('truncates long display names without changing the stored value', () => {
  const player = {
    name: 'A very long player name',
    slot: 1,
    score: 4,
  };

  assert.equal(getPlayerDisplayName(player), 'A very long p...');
  assert.equal(player.name, 'A very long player name');
});

test('consecutive snapshots replace the visible score instead of accumulating it', () => {
  const firstStatePlayer = { id: 'player-1', name: 'Isaac', slot: 1, score: 2 };
  const repeatedStatePlayer = { ...firstStatePlayer };
  const nextStatePlayer = { ...firstStatePlayer, score: 3 };

  assert.equal(formatPlayerScoreLabel(firstStatePlayer), 'Isaac  2');
  assert.equal(formatPlayerScoreLabel(repeatedStatePlayer), 'Isaac  2');
  assert.equal(formatPlayerScoreLabel(nextStatePlayer), 'Isaac  3');
});
