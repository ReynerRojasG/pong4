import {
  MAX_PLAYERS,
  PLAYER_SIDES,
  ROOM_PHASES,
} from '../../shared/protocol.js';

export const SIDE_DETAILS = Object.freeze({
  left: Object.freeze({ label: 'Izquierda', playerLabel: 'PC1' }),
  top: Object.freeze({ label: 'Arriba', playerLabel: 'PC2' }),
  right: Object.freeze({ label: 'Derecha', playerLabel: 'PC3' }),
  bottom: Object.freeze({ label: 'Abajo', playerLabel: 'PC4' }),
});

export function buildLobbySlots(room, playerId) {
  const playersBySlot = new Map(
    (room?.players ?? []).map((player) => [player.slot, player]),
  );

  return Array.from({ length: MAX_PLAYERS }, (_, index) => {
    const slot = index + 1;
    const side = PLAYER_SIDES[index];
    const player = playersBySlot.get(slot) ?? null;

    return {
      slot,
      side,
      sideLabel: SIDE_DETAILS[side].label,
      playerLabel: SIDE_DETAILS[side].playerLabel,
      player,
      occupied: Boolean(player),
      isLocal: player?.id === playerId,
    };
  });
}

export function getLocalPlayer(room, playerId) {
  return room?.players.find((player) => player.id === playerId) ?? null;
}

export function isRoomReady(room) {
  return room?.phase === ROOM_PHASES.READY
    && room.players.length === MAX_PLAYERS
    && room.players.every((player) => player.ready);
}

export function sanitizeRoomCode(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}
