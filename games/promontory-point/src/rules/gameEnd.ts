import { PROMONTORY } from '../components/board.js'
import { isRedTile } from '../components/townTiles.js'
import type { PromontoryPointProjectedState } from '../model/gameState.js'

export enum GameEndReason {
    RedTilesCovered = 'RedTilesCovered',
    BagEmpty = 'BagEmpty'
}

// R-6.1-H1: the end condition counts at most one uncovered red tile.
export const UNCOVERED_RED_TILES_AT_END = 1

type EndTestState = Pick<PromontoryPointProjectedState, 'towns' | 'track' | 'bag'>

// R-6.1, R-6.1-H1, R-6.1-H2: tested after the end-of-turn draw.
export function gameEndReason(state: EndTestState): GameEndReason | undefined {
    if (redTilesCovered(state)) {
        return GameEndReason.RedTilesCovered
    }
    if (state.bag.remaining === 0) {
        return GameEndReason.BagEmpty
    }
    return undefined
}

// R-6.1-H1
export function uncoveredRedTileCount(state: Pick<EndTestState, 'towns' | 'track'>): number {
    return Object.entries(state.towns).filter(
        ([spaceId, kindId]) => isRedTile(kindId) && !(spaceId in state.track)
    ).length
}

// R-6.1
function redTilesCovered(state: EndTestState): boolean {
    return (
        uncoveredRedTileCount(state) <= UNCOVERED_RED_TILES_AT_END &&
        PROMONTORY.spaceId in state.track
    )
}
