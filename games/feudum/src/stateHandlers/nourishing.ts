import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { isNourish, type HydratedNourish } from '../actions/nourish.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { atWillWindow } from '../model/atWill.js'
import { atWillOffers, isAtWillAction, type AtWillAction } from './atWill.js'

export type NourishingAction = AtWillAction | HydratedNourish

/**
 * R-4.10, D11 One seat asked at a time, from `flow.nourish.pending`; it may act at will (R-4.4-H1).
 * `Nourish` passes the question on; with `pending` empty nobody is asked.
 */
export class NourishingStateHandler implements MachineStateHandler<
    NourishingAction,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is NourishingAction {
        return isNourish(action) || isAtWillAction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        const state = context.gameState
        return atWillWindow(state, playerId) === 'nourishing'
            ? [ActionType.Nourish, ...atWillOffers(state, playerId)]
            : []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const next = context.gameState.flow.nourish?.pending[0]
        context.gameState.activePlayerIds = next ? [next] : []
    }

    onAction(
        _action: NourishingAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return MachineState.Nourishing
    }
}
