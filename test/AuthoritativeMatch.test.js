import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthoritativeMatch } from '../server/AuthoritativeMatch.js';
import {
  MATCH_CONFIG,
  MATCH_PHASES,
  getPlayerZone,
} from '../shared/matchConfig.js';

function createRoom() {
  const sides = ['left', 'top', 'right', 'bottom'];

  return {
    code: 'MATCH4',
    players: sides.map((side, index) => ({
      id: `socket-${index + 1}`,
      name: `PC${index + 1}`,
      slot: index + 1,
      side,
      ready: true,
    })),
  };
}

function createMatch(options = {}) {
  return new AuthoritativeMatch({
    room: createRoom(),
    random: () => 0.125,
    now: () => 1000,
    ...options,
  });
}

test('starts with a server countdown and launches one authoritative ball', () => {
  const match = createMatch();

  assert.equal(match.phase, MATCH_PHASES.COUNTDOWN);
  assert.equal(match.ball.velocityX, 0);

  match.step(MATCH_CONFIG.countdownMs - 1);
  assert.equal(match.phase, MATCH_PHASES.COUNTDOWN);

  match.step(1);
  assert.equal(match.phase, MATCH_PHASES.PLAYING);
  assert.ok(Math.abs(match.ball.velocityX) > 0);
  assert.ok(Math.abs(match.ball.velocityY) > 0);
  assert.equal(
    Math.round(Math.hypot(match.ball.velocityX, match.ball.velocityY)),
    MATCH_CONFIG.initialBallSpeed,
  );
});

test('accepts input only for the socket player and clamps it to that side', () => {
  const match = createMatch();
  const leftZone = getPlayerZone('left');

  match.setPaddleTarget('socket-1', { x: 9999, y: -9999 });
  match.step(1000);

  const player = match.players.find((candidate) => candidate.id === 'socket-1');
  assert.equal(player.x, leftZone.maxX);
  assert.equal(player.y, leftZone.minY);
  assert.throws(
    () => match.setPaddleTarget('unknown', { x: 10, y: 10 }),
    (error) => error.code === 'MATCH_PLAYER_NOT_FOUND',
  );
  assert.throws(
    () => match.setPaddleTarget('socket-1', { x: Number.NaN, y: 10 }),
    (error) => error.code === 'INVALID_PADDLE_INPUT',
  );
});

test('reflects the ball against a paddle on the server', () => {
  const match = createMatch();
  const player = match.players[0];
  const collisionDistance = MATCH_CONFIG.playerRadius + MATCH_CONFIG.ballRadius;

  match.phase = MATCH_PHASES.PLAYING;
  match.ball.x = player.x + collisionDistance - 2;
  match.ball.y = player.y;
  match.ball.velocityX = -MATCH_CONFIG.initialBallSpeed;
  match.ball.velocityY = 0;

  match.step(1);

  assert.ok(match.ball.velocityX > 0);
  assert.ok(
    Math.hypot(match.ball.velocityX, match.ball.velocityY)
      > MATCH_CONFIG.initialBallSpeed,
  );
});

test('registers one point for a goal and performs one paused relaunch', () => {
  const match = createMatch();

  match.phase = MATCH_PHASES.PLAYING;
  match.ball.x = MATCH_CONFIG.fieldWidth + MATCH_CONFIG.ballRadius + 1;
  match.ball.y = MATCH_CONFIG.fieldHeight / 2;
  match.ball.velocityX = MATCH_CONFIG.initialBallSpeed;

  match.step(1);

  const leftPlayer = match.players.find((player) => player.side === 'left');
  assert.equal(leftPlayer.score, 1);
  assert.equal(match.phase, MATCH_PHASES.GOAL);
  assert.equal(match.ball.velocityX, 0);

  match.step(MATCH_CONFIG.goalPauseMs - 1);
  assert.equal(leftPlayer.score, 1);
  assert.equal(match.phase, MATCH_PHASES.GOAL);

  match.step(1);
  assert.equal(leftPlayer.score, 1);
  assert.equal(match.phase, MATCH_PHASES.PLAYING);
  assert.ok(Math.hypot(match.ball.velocityX, match.ball.velocityY) > 0);
});

test('finishes by server time and reports every tied leader', () => {
  const match = createMatch();
  match.phase = MATCH_PHASES.PLAYING;
  match.players[0].score = 3;
  match.players[2].score = 3;
  match.timeRemaining = 5;

  match.step(5);
  const snapshot = match.getSnapshot();

  assert.equal(snapshot.phase, MATCH_PHASES.FINISHED);
  assert.equal(snapshot.timeRemaining, 0);
  assert.deepEqual(snapshot.leaders, ['socket-1', 'socket-3']);
  assert.equal(snapshot.ball.velocityX, 0);
  assert.equal(snapshot.ball.velocityY, 0);
});
