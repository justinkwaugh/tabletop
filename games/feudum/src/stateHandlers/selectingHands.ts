import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedFinaliseHand, isFinaliseHand } from '../actions/finaliseHand.js'
import { HydratedRevealPouches, isRevealPouches, RevealPouches } from '../actions/revealPouches.js'
import { HydratedStartRound, isStartRound } from '../actions/startRound.js'
import { ActionType } from '../definition/actions.js'
import { beginPhase, PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { atWillOffers, isAtWillAction, type AtWillAction } from './atWill.js'

/**
 * R-2.2, R-3.1-H1, R-4.4-H1 `StartRound` opens the state and `RevealPouches` closes it; the rest are
 * each seat's that has yet to finalise.
 */
type SelectingHandsAction =
    HydratedStartRound | HydratedFinaliseHand | HydratedRevealPouches | AtWillAction

/** R-3.1-H1 Seats draft in their own clients; every seat yet to finalise is asked at once. */
export class SelectingHandsStateHandler implements MachineStateHandler<
    SelectingHandsAction,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is SelectingHandsAction {
        return (
            isStartRound(action) ||
            isFinaliseHand(action) ||
            isRevealPouches(action) ||
            isAtWillAction(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        const state = context.gameState
        const { selection } = state.flow
        if (!selection || selection.finalised.includes(playerId)) {
            return []
        }
        return [ActionType.FinaliseHand, ...atWillOffers(state, playerId)]
    }

    /**
     * R-3.1-H1 Every seat yet to finalise, in turn order; nobody until `StartRound` has run, nor once
     * all have finalised and `RevealPouches` is to come.
     */
    enter(context: MachineContext<HydratedFeudumGameState>) {
        const state = context.gameState
        const { selection } = state.flow
        state.activePlayerIds = selection
            ? state.turnManager.turnOrder.filter((id) => !selection.finalised.includes(id))
            : []
    }

    /**
     * R-3.1-H1, R-3.2 After the last finaliser every pouch good is revealed together; then cards begin
     * with no turn open: `PlayingCards` asks.
     */
    onAction(
        action: SelectingHandsAction,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        const state = context.gameState
        const { selection } = state.flow
        if (
            isFinaliseHand(action) &&
            selection?.finalised.length === state.turnManager.turnOrder.length
        ) {
            context.addSystemAction(RevealPouches)
            return MachineState.SelectingHands
        }
        if (!isRevealPouches(action)) {
            return MachineState.SelectingHands
        }
        state.flow.selection = undefined
        state.flow.turn = undefined
        beginPhase(state, PhaseName.Cards)
        return MachineState.PlayingCards
    }
}
