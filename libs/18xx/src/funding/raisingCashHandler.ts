import {
    ActionSource,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { crisisSales, type CashCrisisRules, type CashCrisisState } from './cashCrisis.js'
import { HydratedSellSharesToPay, isSellSharesToPay } from './sellSharesToPay.js'
import { isGoBankrupt } from './goBankrupt.js'

type State = HydratedGameState & CashCrisisState

/** A player in debt sells shares until the debt is paid, or goes bankrupt. */
export class RaisingCashHandler implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly rules: CashCrisisRules) {}

    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const crisis = context.gameState.cashCrisis
        if (action.source !== ActionSource.User || crisis?.playerId !== action.playerId)
            return false
        if (isSellSharesToPay(action))
            return action instanceof HydratedSellSharesToPay && action.isValidFor(context.gameState)
        return isGoBankrupt(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        if (state.cashCrisis?.playerId !== playerId) return []
        return [
            ...(crisisSales(state, this.rules, playerId).length ? ['SellSharesToPay'] : []),
            'GoBankrupt'
        ]
    }

    enter(context: MachineContext<State>): void {
        const crisis = context.gameState.cashCrisis
        assertExists(crisis, 'Raising cash requires a debt')
        context.gameState.activePlayerIds = [crisis.playerId]
    }

    onAction(action: HydratedAction, context: MachineContext<State>): string {
        if (context.gameState.cashCrisis) return 'RaisingCash'
        const continuation =
            isSellSharesToPay(action) || isGoBankrupt(action)
                ? action.metadata?.continuation
                : undefined
        assertExists(continuation, 'A settled debt resumes play')
        return continuation
    }
}
