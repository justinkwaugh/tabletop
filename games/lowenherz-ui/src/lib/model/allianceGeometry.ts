import { squareKey, type HydratedLowenherzGameState } from '@tabletop/lowenherz'
import { CELL_SIZE, scaled } from '$lib/model/boardMetrics.js'

export type AllianceWall = { col: number; row: number; edge: string }

/**
 * The boundary walls along an alliance's shared border - the walls that carry its hearts.
 *
 * Takes the state to read rather than closing over the session's, because the burst animator needs
 * the alliance from the `from` state: by the time a cancellation is applied the alliance is gone,
 * and during the animation the exposed state is still `from` anyway. That is what replaced a Map of
 * remembered wall positions refreshed after every action.
 *
 * "wall north of (c,r)" separates (c,r) from (c,r-1); "wall west of (c,r)" separates (c,r) from
 * (c-1,r) - see model/board.ts's wallBetween().
 */
export function allianceWalls(
    state: HydratedLowenherzGameState,
    allianceId: string
): AllianceWall[] {
    const alliance = state.alliances.find((candidate) => candidate.id === allianceId)
    if (!alliance) return []

    const regionA = state.regions.find((region) => region.id === alliance.regionAId)
    const regionB = state.regions.find((region) => region.id === alliance.regionBId)
    if (!regionA || !regionB) return []

    return state.board.walls.filter((wall) => {
        const keyHere = squareKey(wall.col, wall.row)
        const keyThere =
            wall.edge === 'north'
                ? squareKey(wall.col, wall.row - 1)
                : squareKey(wall.col - 1, wall.row)
        return (
            (regionA.squareKeys.includes(keyHere) && regionB.squareKeys.includes(keyThere)) ||
            (regionB.squareKeys.includes(keyHere) && regionA.squareKeys.includes(keyThere))
        )
    })
}

/**
 * Where an alliance's heart sits for one of its boundary walls: centred on the wall, offset by half
 * the glyph box. Shared by the hearts themselves and by the burst animator, so a burst cannot start
 * anywhere but exactly where its heart was.
 *
 * scaled(12) is half of the glyph's scaled(24) box. It was a bare 12 until the board grew, which
 * left every heart 6px off centre.
 */
export function heartPosition(wall: AllianceWall) {
    const half = scaled(12)
    return {
        left: (wall.edge === 'west' ? wall.col : wall.col + 0.5) * CELL_SIZE - half,
        top: (wall.edge === 'west' ? wall.row + 0.5 : wall.row) * CELL_SIZE - half
    }
}
