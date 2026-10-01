import { assertExists } from '@tabletop/common'
import { ActionType, type HydratedOathGameState } from '@tabletop/oath'

export type HeldTurn = { turnPlayerId: string; campaignerId: string }

// Sneak Attack — the turn player's turn waits while another player campaigns.
export function heldTurnOf(state: HydratedOathGameState): HeldTurn | undefined {
    if (!state.heldTurn) return undefined
    const turnPlayerId = state.turnManager.currentTurn()?.playerId
    assertExists(turnPlayerId, "A held turn is some player's turn")
    // R-7.1.4-H2 — the Sneak Attack is asked before its Campaign is declared.
    const campaignerId = state.campaign?.attackerPlayerId ?? state.activePlayerIds[0]
    assertExists(campaignerId, 'A held turn waits on an active player')
    return { turnPlayerId, campaignerId }
}

export function campaignDraftOpens(
    chosen: ActionType | undefined,
    validActionTypes: readonly string[]
): boolean {
    return chosen === ActionType.Campaign && validActionTypes.includes(ActionType.Campaign)
}
