const DEFAULT_MAX_NAME_CHARACTERS = 16;

export function getPlayerDisplayName(
  player,
  maxCharacters = DEFAULT_MAX_NAME_CHARACTERS,
) {
  const fallback = Number.isInteger(player?.slot) ? `PC${player.slot}` : 'PLAYER';
  const name = typeof player?.name === 'string' ? player.name.trim() : '';
  const safeName = name || fallback;
  const characters = Array.from(safeName);

  if (characters.length <= maxCharacters) {
    return safeName;
  }

  return `${characters.slice(0, Math.max(1, maxCharacters - 3)).join('')}...`;
}

export function formatPlayerScoreLabel(player, maxCharacters) {
  return `${getPlayerDisplayName(player, maxCharacters)}  ${player?.score ?? 0}`;
}
