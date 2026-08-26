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

        // Turn-based: proposing hands the move to the other side, so the proposer stops being
        // active. The engine calls enter() after EVERY action, not only on a change of state (see
        // GameEngine.run - nextHandler.enter is unconditional), so this recomputes as moves come
        // in. Nobody has proposed yet right when the negotiation opens (lastProposedBy is
        // undefined), which leaves both free to open with the first proposal.
        //
        // activePlayerIds is not only a display list: GameEngine.isPlayerAllowed gates actions on
        // it, so the last proposer genuinely cannot act again until the other side moves - except
        // for Decline, which HydratedLowenherzGameState.isActivePlayer carves out separately so
        // either negotiator can still force a duel between turns. What the last proposer CAN also
        // do is Undo - undoableAction never consults activePlayerIds, and undoAction applies the
        // action's stored undo patch, which was compared over the whole state after this ran. So
        // undoing the proposal restores lastProposedBy (and so activePlayerIds) to whatever it was
        // before, and they can then revise or decline. Only the completing Propose (the one that
        // matches the standing offer) is beyond undo, being the one flagged revealsInfo.
        context.gameState.activePlayerIds = negotiation.lastProposedBy
            ? negotiation.playerIds.filter((playerId) => playerId !== negotiation.lastProposedBy)
            : [...negotiation.playerIds]
    }

    onAction(
        action: NegotiatingAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        switch (action.kind) {
            // A Propose either just sets (or revises) the standing offer - negotiation
            // still set, stay here - or, if it matched the standing offer exactly,
            // already executed the deal in apply() (negotiation cleared): hand off to
            // wall-placement if it was a border action, otherwise back to
            // ResolvingActions for the next slot.
            case NegotiationMoveKind.Propose: {
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
