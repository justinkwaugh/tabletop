import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import type { Hex } from '../data/boardMap.js'
import type { BuildingTurn, HydratedRideTheRailsGameState } from '../model/gameState.js'
import { hasLegalPlacement, placementsLeft } from './placement.js'

// R-3.2.3, R-3.2.4: the limit is reached, or no placement passes the placement test; R-8: a
// long-distance placement ends the turn.
export type FinishBuildingReason = Type.Static<typeof FinishBuildingReason>
export const FinishBuildingReason = Type.Union([
    Type.Literal('limit'),
    Type.Literal('nothing-legal'),
    Type.Literal('long-distance')
])

// R-3.2.1: placements are made only in the player's own building turn.
export function isBuildingTurnOf(state: HydratedRideTheRailsGameState, playerId: string): boolean {
    return state.building !== undefined && state.turnManager.currentTurn()?.playerId === playerId
}

// R-3.2.1, R-3.2.3, R-3.2.4, R-8: the building turn ends by itself once nothing more is legal.
export function buildingTurnEnd(
    state: HydratedRideTheRailsGameState,
    playerId: string
): FinishBuildingReason | undefined {
    if (state.building?.usedLongDistance) {
        return 'long-distance'
    }
    if (hasLegalPlacement(state, playerId)) {
        return undefined
    }
    return placementsLeft(state) > 0 ? 'nothing-legal' : 'limit'
}

// R-3.2.3, R-3.2.4, R-8: the turn's record once a placement is made; the long-distance mark is
// written only when the placement is in a long-distance hex.
export function recordPlacement(
    building: BuildingTurn,
    { chargesMountain, hex }: { chargesMountain: boolean; hex: Hex }
): BuildingTurn {
    return {
        ...building,
        placed: building.placed + 1,
        usedMountain: building.usedMountain || chargesMountain,
        ...(hex.terrain === 'long-distance' ? { usedLongDistance: true } : {})
    }
}

// R-3.2.1: leaves the building turn, returning how many placements it made.
export function closeBuildingTurn(state: HydratedRideTheRailsGameState): number {
    assertExists(state.building, 'No building turn is open')
    const { placed } = state.building
    state.building = undefined
    return placed
}
