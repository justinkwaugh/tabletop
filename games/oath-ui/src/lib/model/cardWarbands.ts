import type { Color } from '@tabletop/common'
import { revealedVisionIdsOf, warbandEntries, type HydratedOathGameState } from '@tabletop/oath'

export type WarbandCount = { color: Color; count: number }

export function warbandsOnCardOf(state: HydratedOathGameState, cardId: string): WarbandCount[] {
    return warbandEntries(state.warbandsOnCard(cardId))
        .filter(([, count]) => count > 0)
        .map(([color, count]) => ({ color, count }))
}

// False Prophet — another holder's Vision a warband of this player stands on.
export function sharedVisionIdsOf(state: HydratedOathGameState, playerId: string): string[] {
    const own = state.getPlayerState(playerId).revealedVisionId
    return revealedVisionIdsOf(state, playerId).filter((visionId) => visionId !== own)
}
