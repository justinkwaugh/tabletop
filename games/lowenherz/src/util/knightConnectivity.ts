import { Color } from '@tabletop/common'
import { isOnBoard, isWalledBetween, neighbors, squareKey } from '../model/board.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'

// True if removing the knight at (col,row) would NOT strand any of that color's
// OTHER knights - i.e. every remaining knight can still reach at least one of that
// color's castles via a chain of adjacent (non-wall-blocked) knights/castles, the
// same adjacency rule normal knight placement already requires. Removing the last
// knight a color has is always safe (nothing else depends on it) - per the
// rulebook's explicit carve-out ("the last knight remaining in a region may be
// removed leaving a castle alone").
export function isKnightSafeToRemove(
    state: HydratedLowenherzGameState,
    color: Color,
    col: number,
    row: number
): boolean {
    const pieceKeys = new Set<string>()
    const castleKeys: string[] = []
    for (let r = 0; r < state.board.squares.length; r++) {
        for (let c = 0; c < state.board.squares[r].length; c++) {
            if (r === row && c === col) continue // pretend it's already gone
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

    for (const key of pieceKeys) {
        if (!reachable.has(key)) return false
    }
    return true
}
