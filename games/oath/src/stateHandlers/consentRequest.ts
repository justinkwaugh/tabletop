import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    HydratedResolveCitizenshipOffer,
    isResolveCitizenshipOffer
} from '../actions/resolveCitizenshipOffer.js'
import { HydratedAnswerConsent, isAnswerConsent } from '../actions/answerConsent.js'
import {
    isPlayerActionOfType,
    returnClockToTurnPlayer,
    stateAfterCampaignDeclared
} from './handlerSupport.js'

/** R-X.1 — the asked player is on the clock and the asking turn is held. */
export class ConsentRequestStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return isPlayerActionOfType(
            action,
            ActionType.ResolveCitizenshipOffer,
            ActionType.AnswerConsent
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        const state = context.gameState
        if (HydratedResolveCitizenshipOffer.canDoResolveCitizenshipOffer(state, playerId)) {
            return [ActionType.ResolveCitizenshipOffer]
        }
        return HydratedAnswerConsent.canDoAnswerConsent(state, playerId)
            ? [ActionType.AnswerConsent]
            : []
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        const pending = context.gameState.pendingConsent
        if (!pending) return
        // The platform notifies on `activePlayerIds`, not on turn order.
        context.gameState.activePlayerIds = [pending.askedPlayerId]
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        const state = context.gameState
        if (isResolveCitizenshipOffer(action)) {
            returnClockToTurnPlayer(state)

            // R-6.6.2 ends the new Citizen's Act Phase; R-6.6.1 lets that be the turn's player.
            if (action.metadata?.outcome?.endsActPhase) {
                return MachineState.RestPhase
            }
            // Read from the action: `apply()` has already cleared the pending question.
            assertExists(action.metadata, 'The Citizenship answer records where the turn resumes')
            return action.metadata.resumeMachineState
        }
        if (isAnswerConsent(action)) {
            // R-5.5.2.a — the defender is asked next, or the next Citizen.
            if (state.pendingConsent) return MachineState.ConsentRequest
            if (action.metadata?.battle || state.pendingCampaign?.awaitingAttackerPlans) {
                return stateAfterCampaignDeclared(state)
            }
            returnClockToTurnPlayer(state)
            const resume = action.metadata?.resumeMachineState
            assertExists(resume, 'A warband move’s answer records where the turn resumes')
            return resume
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}
