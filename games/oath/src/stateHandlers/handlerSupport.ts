import { type HydratedAction, assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { currentQuestion } from '../util/questions.js'

export function isPlayerActionOfType(action: HydratedAction, ...types: ActionType[]): boolean {
    if (!action.playerId) return false
    return types.some((type) => type === action.type)
}

export function phaseAfterActPhaseAction(
    metadata: { endsActPhase?: boolean } | undefined
): MachineState {
    return metadata?.endsActPhase ? MachineState.RestPhase : MachineState.ActPhase
}

export function returnClockToTurnPlayer(gameState: HydratedOathGameState) {
    const turn = gameState.turnManager.currentTurn()
    if (turn) {
        gameState.activePlayerIds = [turn.playerId]
    }
}

/** R-5.5.2.a's asks first; then R-5.5.3, R-7.5.2 before the roll; R-5.5.5 after it. */
export function stateAfterCampaignDeclared(gameState: HydratedOathGameState): MachineState {
    if (gameState.pendingCampaign) {
        return gameState.pendingCampaign.awaitingAttackerPlans
            ? MachineState.CampaignPlans
            : MachineState.ConsentRequest
    }
    return gameState.campaign?.pendingDefenderPlans
        ? MachineState.CampaignPlans
        : stateAfterCampaignRoll(gameState)
}

/** R-5.5.5 — the attacker picks where the skulls kill (revision 7), then the Battle step. */
export function stateAfterCampaignRoll(gameState: HydratedOathGameState): MachineState {
    return gameState.campaign?.pendingSkullLosses
        ? MachineState.CampaignSkullLosses
        : MachineState.CampaignSacrifice
}

/** Out of turn, the Campaign's clock is not the turn player's. */
export function giveClockTo(gameState: HydratedOathGameState, playerId: string | undefined) {
    if (playerId !== undefined) gameState.activePlayerIds = [playerId]
}

/** Sneak Attack — a Campaign out of turn resumes the turn it interrupted. */
export function stateAfterCampaignEnded(
    gameState: HydratedOathGameState,
    metadata: { resumeMachineState?: MachineState; endsActPhase?: boolean } | undefined
): MachineState {
    returnClockToTurnPlayer(gameState)
    return metadata?.resumeMachineState ?? phaseAfterActPhaseAction(metadata)
}

/** Second Wind out of turn — the Travel's own questions and then the free Campaign, or the held turn resumes. */
export function stateAfterTravelOutOfTurn(
    gameState: HydratedOathGameState,
    metadata: { resumeMachineState?: MachineState } | undefined
): MachineState {
    const next = currentQuestion(gameState)
    if (next) {
        gameState.activePlayerIds = [next.askedPlayerId]
        return MachineState.PowerQuestion
    }
    returnClockToTurnPlayer(gameState)
    assertExists(
        metadata?.resumeMachineState,
        'a Travel out of turn records where the turn resumes'
    )
    return metadata.resumeMachineState
}
