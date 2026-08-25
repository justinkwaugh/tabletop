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
        if (!negotiation) {
            context.gameState.activePlayerIds = []
            return
        }

        // Signing hands the move to the other side, so a signer stops being active. The engine
        // calls enter() after EVERY action, not only on a change of state (see
        // GameEngine.run - nextHandler.enter is unconditional), so this recomputes as moves come
        // in. A fresh Propose clears every signature (NegotiationMove.apply), which brings both
        // back.
        //
        // activePlayerIds is not only a display list: GameEngine.isPlayerAllowed gates actions on
        // it, so a signer genuinely cannot act again until the other side moves. What they CAN do
        // is Undo - undoableAction never consults activePlayerIds, and undoAction applies the
        // action's stored undo patch, which was compared over the whole state after this ran. So
        // undoing the signature restores the signer to this list along with everything else, and
        // they can then revise or decline. Only the SECOND signature is beyond undo, being the one
        // flagged revealsInfo.
        //
        // Unlike Dueling, which deliberately keeps every duelist active until the bids resolve.
        const unsigned = negotiation.playerIds.filter(
            (playerId) => !negotiation.signedPlayerIds.includes(playerId)
        )
        context.gameState.activePlayerIds =
            unsigned.length > 0 ? unsigned : [...negotiation.playerIds]
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
