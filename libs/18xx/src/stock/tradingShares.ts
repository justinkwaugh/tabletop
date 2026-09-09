import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { sharesOwned } from '../finance/finance.js'
import { isBuyShares, type HydratedBuyShares } from './buyShares.js'
import { isSellShares, type HydratedSellShares } from './sellShares.js'
import { isFinishStockTurn, type HydratedFinishStockTurn } from './finishStockTurn.js'
import { evaluateSharePurchase } from './sharePurchase.js'
import { evaluateShareSale } from './shareSale.js'
import { exceedsStockLimits, type StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

type State = HydratedGameState & StockState
type Action = HydratedBuyShares | HydratedSellShares | HydratedFinishStockTurn
export class TradingShares implements MachineStateHandler<Action, State> {
    constructor(
        private readonly rules: StockRules,
        private readonly nextState: string
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        if (
            action.source !== ActionSource.User ||
            !action.playerId ||
            !state.activePlayerIds.includes(action.playerId)
        )
            return false
        if (isBuyShares(action))
            return (
                action.expectedPrice ===
                evaluateSharePurchase(state, action, this.rules).details?.price
            )
        if (isSellShares(action))
            return (
                action.expectedProceeds ===
                evaluateShareSale(state, action, this.rules).details?.proceeds
            )
        return (
            isFinishStockTurn(action) &&
            !exceedsStockLimits(state, { kind: 'player', playerId: action.playerId }, this.rules)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        if (!state.activePlayerIds.includes(playerId)) return []
        const actions: string[] = []
        if (
            this.rules
                .buyers(state, playerId)
                .some((buyer) =>
                    state.certificates.some(
                        (certificate) =>
                            evaluateSharePurchase(
                                state,
                                { playerId, buyer, certificateId: certificate.id },
                                this.rules
                            ).details
                    )
                )
        )
            actions.push('BuyShares')
        if (
            this.rules.sellers(state, playerId).some((seller) =>
                state.companies.some((company) => {
                    for (
                        let shares = 1;
                        shares <= sharesOwned(state, company.id, seller);
                        shares++
                    ) {
                        if (
                            evaluateShareSale(
                                state,
                                { playerId, seller, sales: [{ companyId: company.id, shares }] },
                                this.rules
                            ).details
                        )
                            return true
                    }
                    return false
                })
            )
        )
            actions.push('SellShares')
        if (!exceedsStockLimits(state, { kind: 'player', playerId }, this.rules))
            actions.push('FinishStockTurn')
        return actions
    }
    enter(_context: MachineContext<State>): void {}
    onAction(action: Action, context: MachineContext<State>): string {
        return isFinishStockTurn(action) ? this.nextState : context.gameState.machineState
    }
}
