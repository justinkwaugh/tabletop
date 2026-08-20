import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ALLIANCE_CANCELLATION_COST } from '../actions/cancelAlliance.js'

// Whether this player has an alliance they could pay to end right now - a cheap check
// (participation and the 10 ducats), like every other validActionsForPlayer entry in
// this engine; CancelAlliance's own validation is the authority.
//
// Cancelling is available in every state where the player is the one acting (see the
// note on HydratedCancelAlliance), so several state handlers offer it and share this.
export function canCancelAnAlliance(state: HydratedLowenherzGameState, playerId: string): boolean {
    const playerState = state.getPlayerState(playerId)
    if (playerState.money < ALLIANCE_CANCELLATION_COST) return false
    return state.alliances.some((alliance) => {
        const regionA = state.regions.find((r) => r.id === alliance.regionAId)
        const regionB = state.regions.find((r) => r.id === alliance.regionBId)
        return regionA?.ownerColor === playerState.color || regionB?.ownerColor === playerState.color
    })
}
