// Five player colors in play order: yellow, red, green, purple, orange.
// Brown is excluded because the board itself is brown.
export const PLAYER_COLORS = [
    '#eab308', // yellow-500
    '#ef4444', // red-500
    '#22c55e', // green-500
    '#a855f7', // purple-500
    '#f97316', // orange-500
]

export function playerColorHex(playerIndex: number): string {
    return PLAYER_COLORS[playerIndex] ?? '#9ca3af'
}
