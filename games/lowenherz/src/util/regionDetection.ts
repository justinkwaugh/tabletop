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
// Hands out `region-N` ids that don't collide with any id already in use. Ids have to be
// unique across the whole game, not just within one detection call: a region id is how
// alliances (Alliance.regionAId/regionBId), an in-progress expansion
// (state.expandingRegionId) and every UI lookup identify a region, and every one of those
// lookups is a find-by-id that silently resolves to whichever duplicate comes first.
// Deterministic (no randomness) because client and server both replay the same actions
// and must agree on the ids.
function regionIdMinter(existingIds: Iterable<string>): () => string {
    const usedIds = new Set(existingIds)
    let nextId = 0
    return () => {
        while (usedIds.has(`region-${nextId}`)) nextId++
        const id = `region-${nextId}`
        usedIds.add(id)
        return id
    }
}

// Re-mints any region id that appears more than once, keeping the FIRST occurrence's id
// (that's the one every existing find-by-id already resolved to, so nothing that
// references an id changes meaning) and giving each later duplicate a fresh unused one.
// Returns the number of ids it had to change.
//
// Needed because detectNewRegions used to restart its counter at 0 on every call, so any
// game that created regions in two separate wall placements/expansions ended up with two
// live regions sharing an id - one of which then answered "that isn't one of your regions"
// to everything, most visibly as an expansion with no legal square anywhere. Minting is
// fixed above, but games already in progress carry the collisions in their stored state,
// so this repairs them on hydration (see HydratedLowenherzGameState). Deterministic in
// regions-array order, which client and server share, so both arrive at the same ids.
export function repairDuplicateRegionIds(regions: Region[]): number {
    const seen = new Set<string>()
    const duplicates = regions.filter((region) => {
        if (seen.has(region.id)) return true
        seen.add(region.id)
        return false
    })
    if (duplicates.length === 0) return 0

    const mintId = regionIdMinter(regions.map((r) => r.id))
    for (const region of duplicates) {
        region.id = mintId()
    }
    return duplicates.length
}

export function detectNewRegions(board: LowenherzBoard, existingRegions: Region[]): Region[] {
    const existingSquareKeySets = existingRegions.map((r) => new Set(r.squareKeys))
    const visited = new Set<string>()
    const newRegions: Region[] = []
    const mintId = regionIdMinter(existingRegions.map((r) => r.id))

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
                id: mintId(),
                ownerColor: castleColors.size === 1 ? [...castleColors][0] : undefined,
                squareKeys: componentKeys,
                castleSquareKey: castleColors.size === 1 ? castleSquareKey : undefined
            })
        }
    }

    return newRegions
}
