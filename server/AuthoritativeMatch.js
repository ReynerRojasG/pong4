import {
  MATCH_CONFIG,
  MATCH_PHASES,
  SCORING_SIDE_BY_GOAL,
  getInitialPlayerPosition,
  getPlayerZone,
} from '../shared/matchConfig.js';

const MIN_DIRECTION_COMPONENT = 0.34;
const COLLISION_SPEED_INCREASE = 1.035;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

export class MatchError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MatchError';
    this.code = code;
  }
}

export class AuthoritativeMatch {
  constructor({
    room,
    config = MATCH_CONFIG,
    random = Math.random,
    now = Date.now,
  }) {
    if (!room || room.players?.length !== 4) {
      throw new MatchError('INVALID_MATCH_ROOM', 'A match requires four players.');
    }

    this.roomCode = room.code;
    this.config = config;
    this.random = random;
    this.now = now;
    this.phase = MATCH_PHASES.COUNTDOWN;
    this.countdownRemaining = config.countdownMs;
    this.goalPauseRemaining = 0;
    this.timeRemaining = config.durationMs;
    this.sequence = 0;
    this.lastGoal = null;
    this.finishedAt = null;

    this.players = room.players.map((player) => {
      const position = getInitialPlayerPosition(player.side, config);

      return {
        id: player.id,
        name: player.name,
        slot: player.slot,
        side: player.side,
        x: position.x,
        y: position.y,
        targetX: position.x,
        targetY: position.y,
        score: 0,
      };
    });

    this.ball = {
      x: config.fieldWidth / 2,
      y: config.fieldHeight / 2,
      velocityX: 0,
      velocityY: 0,
    };
  }

  setPaddleTarget(socketId, input) {
    const player = this.players.find((candidate) => candidate.id === socketId);

    if (!player) {
      throw new MatchError('MATCH_PLAYER_NOT_FOUND', 'Player is not part of this match.');
    }

    if (!Number.isFinite(input?.x) || !Number.isFinite(input?.y)) {
      throw new MatchError('INVALID_PADDLE_INPUT', 'Paddle input must contain finite coordinates.');
    }

    const zone = getPlayerZone(player.side, this.config);
    player.targetX = clamp(input.x, zone.minX, zone.maxX);
    player.targetY = clamp(input.y, zone.minY, zone.maxY);
  }

  step(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0 || this.phase === MATCH_PHASES.FINISHED) {
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    this.sequence += 1;
    this.updatePlayers(deltaSeconds);

    if (this.phase === MATCH_PHASES.COUNTDOWN) {
      this.countdownRemaining = Math.max(0, this.countdownRemaining - deltaMs);

      if (this.countdownRemaining === 0) {
        this.phase = MATCH_PHASES.PLAYING;
        this.launchBall();
      }

      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - deltaMs);

    if (this.timeRemaining === 0) {
      this.finish();
      return;
    }

    if (this.phase === MATCH_PHASES.GOAL) {
      this.goalPauseRemaining = Math.max(0, this.goalPauseRemaining - deltaMs);

      if (this.goalPauseRemaining === 0) {
        this.phase = MATCH_PHASES.PLAYING;
        this.launchBall();
      }

      return;
    }

    this.updateBall(deltaSeconds);
  }

  finish() {
    if (this.phase === MATCH_PHASES.FINISHED) {
      return;
    }

    this.phase = MATCH_PHASES.FINISHED;
    this.finishedAt = this.now();
    this.ball.velocityX = 0;
    this.ball.velocityY = 0;
  }

  updatePlayers(deltaSeconds) {
    const maximumDistance = this.config.playerSpeed * deltaSeconds;

    for (const player of this.players) {
      const deltaX = player.targetX - player.x;
      const deltaY = player.targetY - player.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance <= maximumDistance || distance === 0) {
        player.x = player.targetX;
        player.y = player.targetY;
        continue;
      }

      const scale = maximumDistance / distance;
      player.x += deltaX * scale;
      player.y += deltaY * scale;
    }
  }

  launchBall() {
    const angle = this.createLaunchAngle();
    this.ball.x = this.config.fieldWidth / 2;
    this.ball.y = this.config.fieldHeight / 2;
    this.ball.velocityX = Math.cos(angle) * this.config.initialBallSpeed;
    this.ball.velocityY = Math.sin(angle) * this.config.initialBallSpeed;
  }

  createLaunchAngle() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const angle = this.random() * Math.PI * 2;

      if (
        Math.abs(Math.cos(angle)) >= MIN_DIRECTION_COMPONENT
        && Math.abs(Math.sin(angle)) >= MIN_DIRECTION_COMPONENT
      ) {
        return angle;
      }
    }

    return Math.PI / 4;
  }

  updateBall(deltaSeconds) {
    this.ball.x += this.ball.velocityX * deltaSeconds;
    this.ball.y += this.ball.velocityY * deltaSeconds;

    const goalSide = this.detectGoal();

    if (goalSide) {
      this.registerGoal(goalSide);
      return;
    }

    this.handleWalls();
    this.handlePaddleCollisions();
  }

  detectGoal() {
    const { ballRadius, fieldWidth, fieldHeight, goalWidth } = this.config;
    const horizontalGoalStart = fieldWidth / 2 - goalWidth / 2;
    const horizontalGoalEnd = fieldWidth / 2 + goalWidth / 2;
    const verticalGoalStart = fieldHeight / 2 - goalWidth / 2;
    const verticalGoalEnd = fieldHeight / 2 + goalWidth / 2;

    if (
      this.ball.y < -ballRadius
      && this.ball.x >= horizontalGoalStart
      && this.ball.x <= horizontalGoalEnd
    ) {
      return 'top';
    }

    if (
      this.ball.x > fieldWidth + ballRadius
      && this.ball.y >= verticalGoalStart
      && this.ball.y <= verticalGoalEnd
    ) {
      return 'right';
    }

    if (
      this.ball.y > fieldHeight + ballRadius
      && this.ball.x >= horizontalGoalStart
      && this.ball.x <= horizontalGoalEnd
    ) {
      return 'bottom';
    }

    if (
      this.ball.x < -ballRadius
      && this.ball.y >= verticalGoalStart
      && this.ball.y <= verticalGoalEnd
    ) {
      return 'left';
    }

    return null;
  }

  handleWalls() {
    const { ballRadius, fieldWidth, fieldHeight, goalWidth } = this.config;
    const horizontalGoalStart = fieldWidth / 2 - goalWidth / 2;
    const horizontalGoalEnd = fieldWidth / 2 + goalWidth / 2;
    const verticalGoalStart = fieldHeight / 2 - goalWidth / 2;
    const verticalGoalEnd = fieldHeight / 2 + goalWidth / 2;
    const withinHorizontalGoal = this.ball.x >= horizontalGoalStart
      && this.ball.x <= horizontalGoalEnd;
    const withinVerticalGoal = this.ball.y >= verticalGoalStart
      && this.ball.y <= verticalGoalEnd;

    if (!withinHorizontalGoal && this.ball.y - ballRadius <= 0) {
      this.ball.y = ballRadius;
      this.ball.velocityY = Math.abs(this.ball.velocityY);
    } else if (!withinHorizontalGoal && this.ball.y + ballRadius >= fieldHeight) {
      this.ball.y = fieldHeight - ballRadius;
      this.ball.velocityY = -Math.abs(this.ball.velocityY);
    }

    if (!withinVerticalGoal && this.ball.x - ballRadius <= 0) {
      this.ball.x = ballRadius;
      this.ball.velocityX = Math.abs(this.ball.velocityX);
    } else if (!withinVerticalGoal && this.ball.x + ballRadius >= fieldWidth) {
      this.ball.x = fieldWidth - ballRadius;
      this.ball.velocityX = -Math.abs(this.ball.velocityX);
    }
  }

  handlePaddleCollisions() {
    const collisionDistance = this.config.ballRadius + this.config.playerRadius;

    for (const player of this.players) {
      const deltaX = this.ball.x - player.x;
      const deltaY = this.ball.y - player.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance === 0 || distance >= collisionDistance) {
        continue;
      }

      const normalX = deltaX / distance;
      const normalY = deltaY / distance;
      const velocityAlongNormal = this.ball.velocityX * normalX
        + this.ball.velocityY * normalY;

      this.ball.x = player.x + normalX * collisionDistance;
      this.ball.y = player.y + normalY * collisionDistance;

      if (velocityAlongNormal >= 0) {
        continue;
      }

      this.ball.velocityX -= 2 * velocityAlongNormal * normalX;
      this.ball.velocityY -= 2 * velocityAlongNormal * normalY;
      this.increaseBallSpeed();
    }
  }

  increaseBallSpeed() {
    const currentSpeed = Math.hypot(this.ball.velocityX, this.ball.velocityY);

    if (currentSpeed === 0) {
      return;
    }

    const nextSpeed = Math.min(
      this.config.maximumBallSpeed,
      currentSpeed * COLLISION_SPEED_INCREASE,
    );
    const scale = nextSpeed / currentSpeed;
    this.ball.velocityX *= scale;
    this.ball.velocityY *= scale;
  }

  registerGoal(goalSide) {
    const scoringSide = SCORING_SIDE_BY_GOAL[goalSide];
    const scoringPlayer = this.players.find((player) => player.side === scoringSide);

    if (!scoringPlayer) {
      return;
    }

    scoringPlayer.score += 1;
    this.phase = MATCH_PHASES.GOAL;
    this.goalPauseRemaining = this.config.goalPauseMs;
    this.lastGoal = {
      goalSide,
      scoringSide,
      scoringPlayerId: scoringPlayer.id,
      sequence: this.sequence,
    };
    this.ball.x = this.config.fieldWidth / 2;
    this.ball.y = this.config.fieldHeight / 2;
    this.ball.velocityX = 0;
    this.ball.velocityY = 0;
  }

  getSnapshot() {
    const maximumScore = Math.max(...this.players.map((player) => player.score));
    const leaders = this.phase === MATCH_PHASES.FINISHED
      ? this.players
        .filter((player) => player.score === maximumScore)
        .map((player) => player.id)
      : [];

    return {
      roomCode: this.roomCode,
      sequence: this.sequence,
      serverTime: this.now(),
      phase: this.phase,
      countdownRemaining: Math.ceil(this.countdownRemaining / 1000),
      goalPauseRemaining: Math.ceil(this.goalPauseRemaining),
      timeRemaining: Math.ceil(this.timeRemaining),
      field: {
        width: this.config.fieldWidth,
        height: this.config.fieldHeight,
      },
      ball: {
        x: round(this.ball.x),
        y: round(this.ball.y),
        velocityX: round(this.ball.velocityX),
        velocityY: round(this.ball.velocityY),
      },
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        slot: player.slot,
        side: player.side,
        x: round(player.x),
        y: round(player.y),
        score: player.score,
      })),
      lastGoal: this.lastGoal ? { ...this.lastGoal } : null,
      leaders,
      finishedAt: this.finishedAt,
    };
  }
}
