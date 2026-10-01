import {
    revealedVisionIdsOf,
    warbandEntries,
    type HydratedOathGameState,
    type WarbandOwner
} from '@tabletop/oath'

export type WarbandCount = { owner: WarbandOwner; count: number }

export function warbandsOnCardOf(state: HydratedOathGameState, cardId: string): WarbandCount[] {
    return warbandEntries(state.warbandsOnCard(cardId))
        .filter(([, count]) => count > 0)
        .map(([owner, count]) => ({ owner, count }))
}

// False Prophet — another holder's Vision a warband of this player stands on.
export function sharedVisionIdsOf(state: HydratedOathGameState, playerId: string): string[] {
    const own = state.getPlayerState(playerId).revealedVisionId
    return revealedVisionIdsOf(state, playerId).filter((visionId) => visionId !== own)
}
