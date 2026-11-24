import { assertExists } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import { Charters, type CharterId } from '../data/writs.js'
import { placeMarker } from '../model/locationControl.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { takeInfluenceMarkers } from '../model/supply.js'

/** R-4.1.4 The seat rules these spaces, its markers topped up from the general supply. */
export function ruleSpaces(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceIds: readonly SpaceId[]
): void {
    for (const spaceId of spaceIds) {
        if (state.getPlayerState(playerId).influenceSupply === 0) {
            takeInfluenceMarkers(state, playerId, 1)
        }
        placeMarker(state, playerId, spaceId)
    }
    state.recomputeRanks()
}

/** R-4.10.2 The barrel holds this much sulfur, keeping totals. */
export function setBarrel(state: HydratedFeudumGameState, playerId: string, sulfur: number): void {
    const player = state.getPlayerState(playerId)
    state.supply.haversack.sulfur += player.barrel - sulfur
    player.barrel = sulfur
}

/** R-4.4.3, R-6.2 The seat meets this charter as far as it pays. */
export function meetCharter(
    state: HydratedFeudumGameState,
    playerId: string,
    charterId: CharterId
): void {
    const charter = Charters.find(({ id }) => id === charterId)
    assertExists(charter, `${charterId} is a charter`)
    switch (charter.kind) {
        case 'kingdom':
            ruleSpaces(state, playerId, charter.spaces)
            break
        case 'sulfur-barrel':
            setBarrel(state, playerId, 3)
            break
        case 'monster-defeat':
            state.getPlayerState(playerId).defeatedMonster = true
            break
    }
}
