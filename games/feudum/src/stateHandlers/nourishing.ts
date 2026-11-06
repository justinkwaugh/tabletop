import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { atWillOffers, isAtWillAction, type AtWillAction } from './atWill.js'

/** R-4.10 One seat asked at a time, from `flow.nourish.pending`; it may act at will (R-4.4-H1). */
export class NourishingStateHandler implements MachineStateHandler<
    AtWillAction,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is AtWillAction {
        return isAtWillAction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return atWillOffers(context.gameState, playerId)
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const next = context.gameState.flow.nourish?.pending[0]
        context.gameState.activePlayerIds = next ? [next] : []
    }

    onAction(
        _action: AtWillAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return MachineState.Nourishing
    }
}
