import {
    ActionSource,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { HydratedBuyTrain } from '../trains/buyTrain.js'
import { TrainPurchase, type TrainRules } from '../trains/trainPurchase.js'
import type { StockRules } from '../stock/stockRules.js'
import { EmergencyTrainFunding, type FundingState, type TrainFundingRules } from './trainFunding.js'
import { HydratedIssueTreasuryShares } from './issueTreasuryShares.js'
import { HydratedSellFundingShares } from './sellFundingShares.js'
import { HydratedContributeTrainFunds } from './contributeTrainFunds.js'
import { HydratedDeclareBankruptcy, DeclareBankruptcy } from './declareBankruptcy.js'
export class FundingTrainHandler<
    State extends HydratedGameState & FundingState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly rules: TrainFundingRules,
        private readonly stocks: StockRules,
        private readonly trains: TrainRules
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        if (
            action instanceof HydratedIssueTreasuryShares ||
            action instanceof HydratedSellFundingShares ||
            action instanceof HydratedContributeTrainFunds ||
            action instanceof HydratedDeclareBankruptcy
        )
            return action.isValid(state)
        const next = new EmergencyTrainFunding(state, this.rules, this.stocks, this.trains).next()
        return (
            action instanceof HydratedBuyTrain &&
            action.source === ActionSource.User &&
            action.playerId === state.trainFunding?.playerId &&
            state.activePlayerIds.includes(action.playerId) &&
            next.kind === 'buy' &&
            action.companyId === next.purchase.companyId &&
            action.trainId === next.purchase.trainId &&
            action.definitionId === next.purchase.definitionId &&
            !action.exchangeTrainId &&
            new TrainPurchase(state, this.trains).evaluate(action).details?.price ===
                action.expectedPrice
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        if (playerId !== state.trainFunding?.playerId || !state.activePlayerIds.includes(playerId))
            return []
        const next = new EmergencyTrainFunding(state, this.rules, this.stocks, this.trains).next()
        switch (next.kind) {
            case 'issue':
                return ['IssueTreasuryShares']
            case 'contribute':
                return ['ContributeTrainFunds']
            case 'sell':
                return ['SellFundingShares']
            case 'buy':
                return ['BuyTrain']
            case 'bankrupt':
                return []
        }
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        assertExists(state.trainFunding, 'Missing train funding')
        state.activePlayerIds = [state.trainFunding.playerId]
        if (
            new EmergencyTrainFunding(state, this.rules, this.stocks, this.trains).next().kind ===
            'bankrupt'
        )
            context.addSystemAction(DeclareBankruptcy, {})
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        const state = context.gameState
        if (action.type === 'DeclareBankruptcy') return 'Bankrupt'
        if (action instanceof HydratedBuyTrain) {
            delete state.trainFunding
            if (state.phaseChange) state.phaseChange.continuation.machineState = 'BuyingTrains'
            return state.phaseChange ? 'AdvancingPhase' : 'BuyingTrains'
        }
        return 'FundingTrain'
    }
}
