import type { AxialCoordinates } from '@tabletop/common'
import { PieceKind } from './board.js'
import { spaceFromName } from './notation.js'

export type StartingPiece = {
    coords: AxialCoordinates
    white: boolean
    kind: PieceKind
}

// Rule H, diagram 4: each column from its top point down; W/B for the colour, then
// R for a Tzaar, A for a Tzarra, T for a Tott.
const FIXED_COLUMNS: Record<string, string[]> = {
    A: ['WT', 'BT', 'BT', 'BT', 'BT'],
    B: ['WT', 'WA', 'BA', 'BA', 'BA', 'WT'],
    C: ['WT', 'WA', 'WR', 'BR', 'BR', 'WA', 'WT'],
    D: ['WT', 'WA', 'WR', 'WT', 'BT', 'WR', 'WA', 'WT'],
    E: ['BT', 'BA', 'BR', 'BT', 'WT', 'WR', 'WA', 'WT'],
    F: ['BT', 'BA', 'BR', 'WT', 'BT', 'BR', 'BA', 'BT'],
    G: ['BT', 'BA', 'WR', 'WR', 'BR', 'BA', 'BT'],
    H: ['BT', 'WA', 'WA', 'WA', 'BA', 'BT'],
    I: ['WT', 'WT', 'WT', 'WT', 'BT']
}

const KIND_CODES: Record<string, PieceKind> = {
    R: PieceKind.Tzaar,
    A: PieceKind.Tzarra,
    T: PieceKind.Tott
}

export const FIXED_START: readonly StartingPiece[] = Object.entries(FIXED_COLUMNS).flatMap(
    ([column, pieces]) =>
        pieces.map((code, index) => ({
            coords: spaceFromName(`${column}${pieces.length - index}`),
            white: code[0] === 'W',
            kind: KIND_CODES[code[1]]
        }))
)
