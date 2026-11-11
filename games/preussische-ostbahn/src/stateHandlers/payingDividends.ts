import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import { HydratedPayDividends, PayDividends, isPayDividends } from '../actions/payDividends.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'
import { finishSlot } from './flow.js'

export class PayingDividendsStateHandler implements MachineStateHandler<
    HydratedPayDividends,
    HydratedOstbahnGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOstbahnGameState>
    ): action is HydratedPayDividends {
        return isPayDividends(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedOstbahnGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedOstbahnGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(PayDividends, {})
    }

    onAction(
        _action: HydratedPayDividends,
        context: MachineContext<HydratedOstbahnGameState>
    ): MachineState {
        return finishSlot(context.gameState)
    }
}
