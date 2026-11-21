import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import { HydratedPayTaxes, PayTaxes, isPayTaxes } from '../actions/payTaxes.js'
import type { HydratedLwGameState } from '../model/gameState.js'
import { afterTaxes } from './flow.js'

export class PayingTaxesStateHandler implements MachineStateHandler<
    HydratedPayTaxes,
    HydratedLwGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedLwGameState>
    ): action is HydratedPayTaxes {
        return isPayTaxes(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedLwGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedLwGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(PayTaxes, {})
    }

    onAction(action: HydratedPayTaxes, context: MachineContext<HydratedLwGameState>): MachineState {
        assertExists(action.metadata, 'Taxes record whether the game is over')
        return afterTaxes(context.gameState, action.metadata.gameOver)
    }
}
