import {
    assertExists,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { isPayRepairs, type HydratedPayRepairs } from '../actions/payRepairs.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import type { PendingRepairs } from '../model/pendingRepairs.js'
import { stateAfterPlacingAction } from './turnActions.js'

// R-4.3, R-4.3-H4: each debtor in turn pays, the first debtor alone active, whoever's turn it is.
export class PayingRepairsStateHandler implements MachineStateHandler<
    HydratedPayRepairs,
    HydratedPromontoryPointGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): action is HydratedPayRepairs {
        return isPayRepairs(action)
    }

    // R-4.3-H2, R-4.3-H3: a legal sale list always exists, so the first debtor is always offered one.
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedPromontoryPointGameState>
    ): ActionType[] {
        const pendingRepairs = context.gameState.pendingRepairs
        return pendingRepairs !== undefined && this.firstDebtorId(pendingRepairs) === playerId
            ? [ActionType.PayRepairs]
            : []
    }

    enter(context: MachineContext<HydratedPromontoryPointGameState>) {
        const state = context.gameState
        assertExists(state.pendingRepairs, 'A Repairs waits on its debtors')
        state.activePlayerIds = [this.firstDebtorId(state.pendingRepairs)]
    }

    // R-4.3-H4: the turn continues, from the facts alone, once the last debtor has paid.
    onAction(
        _action: HydratedPayRepairs,
        context: MachineContext<HydratedPromontoryPointGameState>
    ): MachineState {
        return stateAfterPlacingAction(context.gameState)
    }

    private firstDebtorId(pendingRepairs: PendingRepairs): string {
        const debtor = pendingRepairs.debtors[0]
        assertExists(debtor, 'A pending Repairs has a debtor')
        return debtor.playerId
    }
}
