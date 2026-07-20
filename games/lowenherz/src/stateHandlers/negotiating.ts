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
        return context.gameState.negotiation?.turnPlayerId === playerId
            ? [ActionType.NegotiationMove]
            : []
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const negotiation = context.gameState.negotiation
        // negotiation should always be defined here - ResolvingActionsStateHandler set
        // it right before transitioning into this state.
        context.gameState.activePlayerIds = negotiation ? [negotiation.turnPlayerId] : []
    }

    onAction(
        action: NegotiatingAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        switch (action.kind) {
            // An offer keeps the negotiation going (turn flips to the other player).
            case NegotiationMoveKind.Offer: {
                return MachineState.Negotiating
            }
            // Accepting resolves the slot - hand off to wall-placement if it was a
            // border action, otherwise go back to ResolvingActions for the next slot.
            case NegotiationMoveKind.Accept: {
                return routeAfterSlotResolved(context.gameState)
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
