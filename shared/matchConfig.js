export const MATCH_PHASES = Object.freeze({
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  GOAL: 'goal',
  FINISHED: 'finished',
});

export const MATCH_CONFIG = Object.freeze({
  fieldWidth: 1000,
  fieldHeight: 750,
  zoneRatio: 0.2,
  goalWidth: 230,
  ballRadius: 14,
  playerRadius: 30,
  playerSpeed: 900,
  initialBallSpeed: 390,
  maximumBallSpeed: 620,
  countdownMs: 3000,
  goalPauseMs: 900,
  durationMs: 120000,
  tickRate: 60,
  snapshotRate: 20,
});

export function getPlayerZone(side, config = MATCH_CONFIG) {
  const {
    fieldWidth,
    fieldHeight,
    playerRadius,
    zoneRatio,
  } = config;
  const verticalDepth = fieldWidth * zoneRatio;
  const horizontalDepth = fieldHeight * zoneRatio;

  const zones = {
    left: {
      minX: playerRadius,
      maxX: verticalDepth - playerRadius,
      minY: horizontalDepth + playerRadius,
      maxY: fieldHeight - horizontalDepth - playerRadius,
    },
    top: {
      minX: verticalDepth + playerRadius,
      maxX: fieldWidth - verticalDepth - playerRadius,
      minY: playerRadius,
      maxY: horizontalDepth - playerRadius,
    },
    right: {
      minX: fieldWidth - verticalDepth + playerRadius,
      maxX: fieldWidth - playerRadius,
      minY: horizontalDepth + playerRadius,
      maxY: fieldHeight - horizontalDepth - playerRadius,
    },
    bottom: {
      minX: verticalDepth + playerRadius,
      maxX: fieldWidth - verticalDepth - playerRadius,
      minY: fieldHeight - horizontalDepth + playerRadius,
      maxY: fieldHeight - playerRadius,
    },
  };

  return zones[side];
}

export function getInitialPlayerPosition(side, config = MATCH_CONFIG) {
  const zone = getPlayerZone(side, config);

  return {
    x: (zone.minX + zone.maxX) / 2,
    y: (zone.minY + zone.maxY) / 2,
  };
}
