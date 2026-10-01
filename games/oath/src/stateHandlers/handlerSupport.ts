import { type HydratedAction } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedOathGameState } from '../model/gameState.js'

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
