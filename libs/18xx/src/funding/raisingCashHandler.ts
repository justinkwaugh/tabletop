import {
    ActionSource,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import {
    crisisInsolvencyChoices,
    crisisSales,
    currentDebt,
    debtInsolvency,
    type CashCrisisRules,
    type CashCrisisState
} from './cashCrisis.js'
import type { FundingState } from './trainFunding.js'
import { HydratedSellSharesToPay, isSellSharesToPay } from './sellSharesToPay.js'
import { GoBankrupt, HydratedGoBankrupt, isGoBankrupt } from './goBankrupt.js'

type State = HydratedGameState & CashCrisisState & FundingState

/** A player in debt sells shares until the debt is paid, or goes bankrupt. */
export class RaisingCashHandler implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly rules: CashCrisisRules) {}

    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (currentDebt(context.gameState)?.playerId !== action.playerId) return false
        if (isSellSharesToPay(action))
            return (
                action.source === ActionSource.User &&
                action instanceof HydratedSellSharesToPay &&
                action.isValidFor(context.gameState)
            )
        return action instanceof HydratedGoBankrupt && action.isValidFor(context.gameState)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const debt = currentDebt(state)
        if (debt?.playerId !== playerId) return []
        const selling = crisisSales(state, this.rules, playerId).length > 0
        // A failing company's president sells all they can first, and the System declares a
        // failure that leaves them nothing to choose.
        const declares = debtInsolvency(this.rules, debt)
            ? !selling && crisisInsolvencyChoices(state, this.rules, debt).length > 0
            : true
        return [...(selling ? ['SellSharesToPay'] : []), ...(declares ? ['GoBankrupt'] : [])]
    }

    enter(context: MachineContext<State>): void {
        const state = context.gameState
        const debt = currentDebt(state)
        assertExists(debt, 'Raising cash requires a debt')
        state.activePlayerIds = [debt.playerId]
        if (
            debtInsolvency(this.rules, debt) &&
            !crisisSales(state, this.rules, debt.playerId).length &&
            !crisisInsolvencyChoices(state, this.rules, debt).length
        )
            context.addSystemAction(GoBankrupt, { playerId: debt.playerId })
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
