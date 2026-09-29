import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import type { Region } from '../model/oathEnums.js'

/** R-1.23.1 — every pawn stands at a site once the game is set up. */
export function pawnSiteId(state: HydratedOathGameState, playerId: string): string {
    const siteId = state.getPlayerState(playerId).siteId
    assertExists(siteId, `${playerId}'s pawn must be at a site`)
    return siteId
}

/** R-2.2 — every map slot belongs to a region. */
export function regionOfPawn(state: HydratedOathGameState, playerId: string): Region {
    return state.regionOf(pawnSiteId(state, playerId))
}
