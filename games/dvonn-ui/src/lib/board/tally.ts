import { isDvonnPiece, stackOwner, type Piece, type Stack } from '@tabletop/dvonn'

export const TALLY_HEIGHT = 10

// The pieces in the stacks a player controls, their own color first, then DVONN pieces, then
// the other color, laid out as stacks of at most TALLY_HEIGHT and read right to left.
export function controlledTally(stacks: readonly Stack[], playerId: string): Piece[][] {
    const rank = (piece: Piece) => (isDvonnPiece(piece) ? 1 : piece.playerId === playerId ? 0 : 2)
    const pieces = stacks
        .filter((stack) => stackOwner(stack.pieces) === playerId)
        .flatMap((stack) => stack.pieces)
        .toSorted((a, b) => rank(a) - rank(b))
    return inStacks(pieces)
}

// Right to left, as the card right-aligns it: full stacks on the right, what is left over first.
export function inStacks<T>(items: readonly T[]): T[][] {
    return Array.from({ length: Math.ceil(items.length / TALLY_HEIGHT) }, (_, index) =>
        items.slice(index * TALLY_HEIGHT, (index + 1) * TALLY_HEIGHT)
    ).reverse()
}
