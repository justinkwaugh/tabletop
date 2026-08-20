import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedNegotiationMove, NegotiationMoveKind } from '../actions/negotiationMove.js'
import { routeAfterSlotResolved } from '../util/resolutionHelpers.js'

type NegotiatingAction = HydratedNegotiationMove

export class NegotiatingStateHandler
    implements MachineStateHandler<NegotiatingAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is NegotiatingAction {
        return action instanceof HydratedNegotiationMove && action.isValidNegotiationMove(context.gameState)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLowenherzGameState>
    ): ActionType[] {
        return context.gameState.negotiation?.playerIds.includes(playerId)
            ? [ActionType.NegotiationMove]
            : []
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const negotiation = context.gameState.negotiation
        // Both negotiators are active at once - either can propose/sign/decline at
        // any time, unlike Dueling's initial (soon-to-be-familiar) "everyone who
        // hasn't acted yet" set, this one never shrinks as moves come in.
        context.gameState.activePlayerIds = negotiation ? [...negotiation.playerIds] : []
    }

    onAction(
        action: NegotiatingAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        switch (action.kind) {
            // Proposing (or revising) the standing offer keeps the negotiation going.
            case NegotiationMoveKind.Propose: {
                return MachineState.Negotiating
            }
            // A Sign either just records one signature (negotiation still set, stay
            // here) or - if it was the second - already executed the deal in apply()
            // (negotiation cleared): hand off to wall-placement if it was a border
            // action, otherwise back to ResolvingActions for the next slot.
            case NegotiationMoveKind.Sign: {
                if (context.gameState.negotiation) {
                    return MachineState.Negotiating
                }
                return routeAfterSlotResolved(context.gameState).nextState
            }
            // Declining already set up gameState.duel (see NegotiationMove.apply) - go
            // straight to Dueling. Routing through ResolvingActions here would be
            // wrong: it would just re-derive the same 2-way tie and start a fresh
            // negotiation instead of respecting the duel already in progress.
            case NegotiationMoveKind.Decline: {
                return MachineState.Dueling
            }
        }
    }
}
