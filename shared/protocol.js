export const MAX_PLAYERS = 4;

export const PLAYER_SIDES = Object.freeze([
  'left',
  'top',
  'right',
  'bottom',
]);

export const ROOM_PHASES = Object.freeze({
  LOBBY: 'lobby',
  READY: 'ready',
});

export const CLIENT_EVENTS = Object.freeze({
  CREATE_ROOM: 'room:create',
  JOIN_ROOM: 'room:join',
  LEAVE_ROOM: 'room:leave',
  SET_READY: 'room:set-ready',
  PADDLE_INPUT: 'match:paddle-input',
});

export const SERVER_EVENTS = Object.freeze({
  CONNECTION_READY: 'connection:ready',
  ROOM_STATE: 'room:state',
  MATCH_READY: 'match:ready',
  MATCH_STATE: 'match:state',
  MATCH_ENDED: 'match:ended',
  MATCH_ERROR: 'match:error',
});
