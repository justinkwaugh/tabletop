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

export type HeartPosition = { left: number; top: number }

export const HEART_BOX = scaled(12)

const HEART_OFFSETS_ALONG_WALL = [0.3, 0.7]

/**
 * Where an alliance's hearts sit along one of its boundary walls. Shared by the hearts themselves
 * and by the form/burst animators, so a burst cannot start anywhere but exactly where its heart was.
 */
export function heartPositions(wall: AllianceWall): HeartPosition[] {
    const half = HEART_BOX / 2
    return HEART_OFFSETS_ALONG_WALL.map((offset) => ({
        left: (wall.edge === 'west' ? wall.col : wall.col + offset) * CELL_SIZE - half,
        top: (wall.edge === 'west' ? wall.row + offset : wall.row) * CELL_SIZE - half
    }))
}
