import { HydratedLowenherzGameState } from '../model/gameState.js'
import { getSquare, neighbors, SquareType } from '../model/board.js'

// Where the knight that comes with a setup castle may go. Shared because both halves of
// the placement need it: PlaceCastle refuses a castle square with no legal knight square
// (a dead end, since setup has no Pass), and PlaceSetupKnight validates the square the
// player actually picks.
export function isValidSetupKnightSquare(
    state: HydratedLowenherzGameState,
    castleCol: number,
    castleRow: number,
    knightCol: number,
    knightRow: number
): boolean {
    const isAdjacentToCastle = neighbors(castleCol, castleRow).some(
        (n) => n.col === knightCol && n.row === knightRow
    )
    if (!isAdjacentToCastle) return false

    const knightSquare = getSquare(state.board, knightCol, knightRow)
    if (!knightSquare) return false
    // Knights may never be placed on wooded spaces during setup (only during regular
    // in-game play, where they're allowed for a ducat cost).
    if (knightSquare.type !== SquareType.Blank) return false
    if (knightSquare.castleOwner || knightSquare.knightOwner) return false

    return true
}

export function legalSetupKnightSquares(
    state: HydratedLowenherzGameState,
    castleCol: number,
    castleRow: number
): { col: number; row: number }[] {
    return neighbors(castleCol, castleRow).filter((n) =>
        isValidSetupKnightSquare(state, castleCol, castleRow, n.col, n.row)
    )
}

export function hasLegalSetupKnightSquare(
    state: HydratedLowenherzGameState,
    castleCol: number,
    castleRow: number
): boolean {
    return legalSetupKnightSquares(state, castleCol, castleRow).length > 0
}
