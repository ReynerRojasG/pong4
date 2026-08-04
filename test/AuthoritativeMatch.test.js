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
  const names = ['Isaac', 'Reyner', 'Andres', 'Maria'];

  return {
    code: 'MATCH4',
    players: sides.map((side, index) => ({
      id: `socket-${index + 1}`,
      name: names[index],
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
  assert.equal(match.ball.lastTouchPlayerId, player.id);
});

test('awards exactly one point to the last player who touched before an opponent goal', () => {
  const match = createMatch();
  const leftPlayer = match.players.find((player) => player.side === 'left');

  match.phase = MATCH_PHASES.PLAYING;
  match.ball.lastTouchPlayerId = leftPlayer.id;
  match.ball.x = MATCH_CONFIG.fieldWidth + MATCH_CONFIG.ballRadius + 1;
  match.ball.y = MATCH_CONFIG.fieldHeight / 2;
  match.ball.velocityX = MATCH_CONFIG.initialBallSpeed;

  match.step(1);

  assert.equal(leftPlayer.score, 1);
  assert.equal(match.phase, MATCH_PHASES.GOAL);
  assert.equal(match.goalInProgress, true);
  assert.equal(match.ball.velocityX, 0);
  assert.equal(match.ball.lastTouchPlayerId, null);
  assert.equal(match.lastGoal.concedingPlayerId, 'socket-3');
  assert.equal(match.lastGoal.scoringPlayerId, leftPlayer.id);

  match.step(MATCH_CONFIG.goalPauseMs - 1);
  assert.equal(leftPlayer.score, 1);
  assert.equal(match.phase, MATCH_PHASES.GOAL);

  match.step(1);
  assert.equal(leftPlayer.score, 1);
  assert.equal(match.phase, MATCH_PHASES.PLAYING);
  assert.equal(match.goalInProgress, false);
  assert.equal(match.roundId, 2);
  assert.equal(match.lastGoal, null);
  assert.ok(Math.hypot(match.ball.velocityX, match.ball.velocityY) > 0);
});

test('does not award a point when the last player touches into their own goal', () => {
  const match = createMatch();
  const concedingPlayer = match.players.find((player) => player.side === 'left');

  match.phase = MATCH_PHASES.PLAYING;
  match.ball.lastTouchPlayerId = concedingPlayer.id;
  match.ball.x = -MATCH_CONFIG.ballRadius - 1;
  match.ball.y = MATCH_CONFIG.fieldHeight / 2;
  match.ball.velocityX = -MATCH_CONFIG.initialBallSpeed;
  match.step(1);

  assert.equal(concedingPlayer.score, 0);
  assert.equal(match.lastGoal.awarded, false);
  assert.equal(match.lastGoal.scoringPlayerId, null);
  assert.equal(match.lastGoal.lastTouchPlayerId, concedingPlayer.id);
  assert.equal(match.phase, MATCH_PHASES.GOAL);
});

test('does not choose an arbitrary scorer when no valid last touch exists', () => {
  const match = createMatch();

  match.phase = MATCH_PHASES.PLAYING;
  match.ball.x = MATCH_CONFIG.fieldWidth + MATCH_CONFIG.ballRadius + 1;
  match.ball.y = MATCH_CONFIG.fieldHeight / 2;
  match.ball.velocityX = MATCH_CONFIG.initialBallSpeed;
  match.step(1);

  assert.deepEqual(match.players.map((player) => player.score), [0, 0, 0, 0]);
  assert.equal(match.lastGoal.lastTouchPlayerId, null);
  assert.equal(match.lastGoal.scoringPlayerId, null);
});

test('ignores duplicate goal processing in consecutive updates', () => {
  const logs = [];
  const match = createMatch({ goalLogger: (message) => logs.push(message) });
  const scorer = match.players[0];

  match.phase = MATCH_PHASES.PLAYING;
  match.ball.lastTouchPlayerId = scorer.id;
  assert.equal(match.registerGoal('right'), true);
  assert.equal(match.registerGoal('right'), false);
  match.step(1);

  assert.equal(scorer.score, 1);
  assert.equal(logs.filter((message) => message.startsWith('[GOAL]')).length, 1);
  assert.equal(logs.filter((message) => message.startsWith('[GOAL_IGNORED]')).length, 1);
  assert.match(logs[0], /concedingPlayerId=socket-3/);
  assert.match(logs[0], /scoringPlayerId=socket-1/);
  assert.match(logs[1], /reason=goal-in-progress/);
});

test('clears round contact state and can score again after the relaunch', () => {
  const match = createMatch();
  const scorer = match.players[0];

  match.phase = MATCH_PHASES.PLAYING;
  match.ball.lastTouchPlayerId = scorer.id;
  match.registerGoal('right');
  match.step(MATCH_CONFIG.goalPauseMs);

  assert.equal(match.roundId, 2);
  assert.equal(match.ball.lastTouchPlayerId, null);
  assert.equal(match.ball.x, MATCH_CONFIG.fieldWidth / 2);
  assert.equal(match.ball.y, MATCH_CONFIG.fieldHeight / 2);
  assert.ok(Math.hypot(match.ball.velocityX, match.ball.velocityY) > 0);

  match.ball.lastTouchPlayerId = scorer.id;
  match.ball.y = -MATCH_CONFIG.ballRadius - 1;
  match.ball.x = MATCH_CONFIG.fieldWidth / 2;
  match.ball.velocityX = 0;
  match.ball.velocityY = -MATCH_CONFIG.initialBallSpeed;
  match.step(1);

  assert.equal(scorer.score, 2);
  assert.equal(match.lastGoal.roundId, 2);
});

test('keeps four stable names in every authoritative snapshot', () => {
  const match = createMatch();
  const snapshot = match.getSnapshot();

  assert.deepEqual(
    snapshot.players.map(({ id, name, side, score }) => ({ id, name, side, score })),
    [
      { id: 'socket-1', name: 'Isaac', side: 'left', score: 0 },
      { id: 'socket-2', name: 'Reyner', side: 'top', score: 0 },
      { id: 'socket-3', name: 'Andres', side: 'right', score: 0 },
      { id: 'socket-4', name: 'Maria', side: 'bottom', score: 0 },
    ],
  );
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
