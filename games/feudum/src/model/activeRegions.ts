import { Spaces } from '../data/board.js'
import { RegionIds, type RegionId } from '../data/regionTiles.js'
import { DisloyaltyDawns, MilitaryServiceTrack, type Epoch } from '../data/tracks.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { coveredServiceSpaces } from './tracks.js'

/** R-4.12.1 */
const ActiveRegionScores: readonly number[] = [0, 1, 3, 5, 7, 9, 11]

/** R-4.1.4, R-4.12.1 Regions where the player rules a location or their serf tends a landscape. */
export function activeRegionIds(state: HydratedFeudumGameState, playerId: string): RegionId[] {
    const active = Spaces.filter(({ id }) => {
        const { ruler, serf, landscape } = state.spaces[id]
        return ruler?.playerId === playerId || (landscape && serf?.playerId === playerId)
    })
    return RegionIds.filter((region) => active.some((space) => space.region === region))
}

/** R-4.12.1 */
export function activeRegionVp(state: HydratedFeudumGameState, playerId: string): number {
    return ActiveRegionScores[activeRegionIds(state, playerId).length]
}

/** R-4.9.2, R-4.9-H2 Negative, or 0. */
export function disloyaltyVp(
    state: HydratedFeudumGameState,
    playerId: string,
    dawn: Epoch
): number {
    if (!DisloyaltyDawns.includes(dawn) || !state.isVassal(playerId)) {
        return 0
    }
    const covered = coveredServiceSpaces(state, playerId)
    return MilitaryServiceTrack.filter(
        (space) => space.dueFrom <= dawn && !covered.includes(space)
    ).reduce((sum, space) => sum + space.penalty, 0)
}
