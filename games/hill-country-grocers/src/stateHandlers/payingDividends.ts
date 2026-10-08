import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedPayDividends, PayDividends, isPayDividends } from '../actions/payDividends.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { endTurn } from './flow.js'

export class PayingDividendsStateHandler implements MachineStateHandler<
    HydratedPayDividends,
    HydratedHcgGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedHcgGameState>
    ): action is HydratedPayDividends {
        return isPayDividends(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedHcgGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedHcgGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(PayDividends, {})
    }

    onAction(
        action: HydratedPayDividends,
        context: MachineContext<HydratedHcgGameState>
    ): MachineState {
        if (action.metadata?.final) {
            context.gameState.turnManager.endTurn(context.gameState.actionCount)
            return MachineState.EndOfGame
        }
        return endTurn(context.gameState)
    }
}
