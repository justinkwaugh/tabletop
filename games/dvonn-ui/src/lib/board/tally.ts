import { isDvonnPiece, stackOwner, type Piece, type Space } from '@tabletop/dvonn'

export const TALLY_HEIGHT = 10

// The pieces in the stacks a player controls, their own color first, then DVONN pieces, then
// the other color, laid out as stacks of at most TALLY_HEIGHT.
export function controlledTally(spaces: readonly Space[], playerId: string): Piece[][] {
    const rank = (piece: Piece) => (isDvonnPiece(piece) ? 1 : piece.playerId === playerId ? 0 : 2)
    const pieces = spaces
        .filter((space) => stackOwner(space.stack) === playerId)
        .flatMap((space) => space.stack)
        .toSorted((a, b) => rank(a) - rank(b))
    return inStacks(pieces)
}

export function inStacks<T>(items: readonly T[]): T[][] {
    return Array.from({ length: Math.ceil(items.length / TALLY_HEIGHT) }, (_, index) =>
        items.slice(index * TALLY_HEIGHT, (index + 1) * TALLY_HEIGHT)
    )
}
