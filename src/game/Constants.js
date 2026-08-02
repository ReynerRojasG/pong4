export const COLORS = {
  background: 0x0d0e13,
  table: 0x121318,
  tablePanel: 0x1a1b21,
  borderDim: 0x3a494b,
  grid: 0x00dbe7,
  center: 0xe3e1e9,
  blue: 0x00dbe7,
  yellow: 0xe9c400,
  green: 0x2ae500,
  red: 0xff8a80,
  white: 0xffffff,
  shadow: 0x000000,
};

export const SIDE_COLORS = {
  top: COLORS.yellow,
  right: COLORS.green,
  bottom: COLORS.red,
  left: COLORS.blue,
};

export const BOARD = {
  aspectRatio: 4 / 3,
  marginRatio: 0.08,
  zoneRatio: 0.2,
  goalWidthRatio: 0.3,
  goalDepthRatio: 0.045,
  paddingRatio: 0.045,
  cornerRadiusRatio: 0.055,
  gridSize: 32,
};

export const PHYSICS = {
  wallThickness: 18,
};

export const PUCK = {
  radius: 14,
  minSpeed: 270,
  maxSpeed: 360,
};

export const PLAYER = {
  radius: 30,
  followLerp: 0.18,
};

export const PLAYERS = [
  { index: 1, side: 'left', color: COLORS.blue, isControlled: true },
  { index: 2, side: 'top', color: COLORS.yellow, isControlled: false },
  { index: 3, side: 'right', color: COLORS.green, isControlled: false },
  { index: 4, side: 'bottom', color: COLORS.red, isControlled: false },
];

export const PLAYER_SIDE_BY_INDEX = {
  1: 'left',
  2: 'top',
  3: 'right',
  4: 'bottom',
};

export const CAMERA_ROTATION_BY_SIDE = {
  bottom: 0,
  left: Math.PI / 2,
  top: Math.PI,
  right: -Math.PI / 2,
};
