import { Color } from '@tabletop/common'
import { isOnBoard, isWalledBetween, neighbors, squareKey } from '../model/board.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'

// Every piece of `color` that can reach one of that color's castles via a chain of
// adjacent (non-wall-blocked) knights/castles - the same adjacency rule normal knight
// placement requires. `skip` is treated as already gone from the board.
function reachablePieces(
    state: HydratedLowenherzGameState,
    color: Color,
    skip?: { col: number; row: number }
): { pieceKeys: Set<string>; reachable: Set<string> } {
    const pieceKeys = new Set<string>()
    const castleKeys: string[] = []
    for (let r = 0; r < state.board.squares.length; r++) {
        for (let c = 0; c < state.board.squares[r].length; c++) {
            if (skip && r === skip.row && c === skip.col) continue
            const square = state.board.squares[r][c]
            const key = squareKey(c, r)
            if (square.knightColor === color) pieceKeys.add(key)
            if (square.castleColor === color) {
                pieceKeys.add(key)
                castleKeys.push(key)
            }
        }
    }

    const reachable = new Set<string>(castleKeys)
    const stack = [...castleKeys]
    while (stack.length > 0) {
        const currentKey = stack.pop()!
        const [cCol, cRow] = currentKey.split(',').map(Number)
        for (const n of neighbors(cCol, cRow)) {
            if (!isOnBoard(n.col, n.row)) continue
            const nKey = squareKey(n.col, n.row)
            if (!pieceKeys.has(nKey) || reachable.has(nKey)) continue
            if (isWalledBetween(state.board, cCol, cRow, n.col, n.row)) continue
            reachable.add(nKey)
            stack.push(nKey)
        }
    }

    return { pieceKeys, reachable }
}

// True if removing the knight at (col,row) would NOT strand any of that color's
// OTHER knights - i.e. every remaining knight can still reach at least one of that
// color's castles via a chain of adjacent (non-wall-blocked) knights/castles, the
// same adjacency rule normal knight placement already requires. Removing the last
// knight a color has is always safe (nothing else depends on it) - per the
// rulebook's explicit carve-out ("the last knight remaining in a region may be
// removed leaving a castle alone").
//
// Judged as a DIFFERENCE against the board as it stands, not against a perfectly
// connected ideal: a knight that is already cut off stays cut off either way, and this
// removal isn't what did it. Blaming the candidate for pre-existing damage meant one
// stranded knight anywhere made every square of that color unsafe forever, which quietly
// disabled Renegade against that color for the rest of the game (ExpandRegion's wall ring
// could strand a knight exactly that way - see separatesSamePrincePieces).
export function isKnightSafeToRemove(
    state: HydratedLowenherzGameState,
    color: Color,
    col: number,
    row: number
): boolean {
    const after = reachablePieces(state, color, { col, row })

    // Fast path: nothing stranded once it's gone, so there's nothing to attribute.
    let strandedAfter = false
    for (const key of after.pieceKeys) {
        if (!after.reachable.has(key)) {
            strandedAfter = true
            break
        }
    }
    if (!strandedAfter) return true

    // Something is stranded - only refuse if THIS removal is what stranded it.
    const before = reachablePieces(state, color)
    for (const key of after.pieceKeys) {
        if (!after.reachable.has(key) && before.reachable.has(key)) return false
    }
    return true
}
