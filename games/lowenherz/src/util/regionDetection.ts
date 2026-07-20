import { Color } from '@tabletop/common'
import {
    BOARD_COLS,
    BOARD_ROWS,
    getSquare,
    isOnBoard,
    isWalledBetween,
    LowenherzBoard,
    neighbors,
    squareKey
} from '../model/board.js'
import { Region } from '../model/region.js'

// Finds every maximal wall-enclosed connected component of squares that isn't already
// exactly one of the existing tracked regions. A component only becomes a new Region if
// it contains exactly 0 castles (a neutral zone) or exactly 1 castle color (that
// color's new region) - per the rulebook, a component enclosing 2+ different castle
// colors isn't controlled by anyone and is skipped, same as the wide-open, mostly
// unwalled rest of the board early in the game.
export function detectNewRegions(board: LowenherzBoard, existingRegions: Region[]): Region[] {
    const existingSquareKeySets = existingRegions.map((r) => new Set(r.squareKeys))
    const visited = new Set<string>()
    const newRegions: Region[] = []
    let nextId = 0

    for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
            const startKey = squareKey(col, row)
            if (visited.has(startKey)) continue

            const component: { col: number; row: number }[] = []
            const stack = [{ col, row }]
            visited.add(startKey)
            while (stack.length > 0) {
                const current = stack.pop()!
                component.push(current)
                for (const n of neighbors(current.col, current.row)) {
                    if (!isOnBoard(n.col, n.row)) continue
                    const nKey = squareKey(n.col, n.row)
                    if (visited.has(nKey)) continue
                    if (isWalledBetween(board, current.col, current.row, n.col, n.row)) continue
                    visited.add(nKey)
                    stack.push(n)
                }
            }

            const componentKeys = component.map((s) => squareKey(s.col, s.row))
            const componentKeySet = new Set(componentKeys)

            const alreadyTracked = existingSquareKeySets.some(
                (set) => set.size === componentKeySet.size && [...set].every((k) => componentKeySet.has(k))
            )
            if (alreadyTracked) continue

            const castleColors = new Set<Color>()
            let castleSquareKey: string | undefined
            for (const sq of component) {
                const square = getSquare(board, sq.col, sq.row)
                if (square?.castleColor) {
                    castleColors.add(square.castleColor)
                    castleSquareKey = squareKey(sq.col, sq.row)
                }
            }

            // Enclosed by 2+ different castles - not a region at all (neither prince
            // controls it), so nothing is created here.
            if (castleColors.size > 1) continue

            newRegions.push({
                id: `region-${nextId++}`,
                ownerColor: castleColors.size === 1 ? [...castleColors][0] : undefined,
                squareKeys: componentKeys,
                castleSquareKey: castleColors.size === 1 ? castleSquareKey : undefined
            })
        }
    }

    return newRegions
}
