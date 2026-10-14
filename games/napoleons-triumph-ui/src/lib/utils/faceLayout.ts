export const FACE_SYMBOL_GAP = 3
export const BLOCK_SYMBOL_WIDTH = 16
export const BLOCK_SYMBOL_HEIGHT = 11

/** How wide a unit's row of symbols is: one symbol for each step of strength. */
export function faceWidth(strength: number, symbolWidth: number): number {
    return strength * symbolWidth + (strength - 1) * FACE_SYMBOL_GAP
}
