import {
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { BuyTrain, HydratedBuyTrain } from '../trains/buyTrain.js'
import { TrainPurchase, type TrainRules } from '../trains/trainPurchase.js'
import type { StockRules } from '../stock/stockRules.js'
import {
    EmergencyTrainFunding,
    type FundingChoice,
    type FundingState,
    type TrainFundingRules
} from './trainFunding.js'
import { HydratedIssueTreasuryShares, IssueTreasuryShares } from './issueTreasuryShares.js'
import { HydratedSellFundingShares } from './sellFundingShares.js'
import { ContributeTrainFunds, HydratedContributeTrainFunds } from './contributeTrainFunds.js'
import { HydratedDeclareBankruptcy, DeclareBankruptcy } from './declareBankruptcy.js'
import { controllingOwner } from '../finance/finance.js'
import { privateExchangeOffers } from '../privates/privateExchange.js'
import type { PrivateRules } from '../privates/privateRules.js'
export class FundingTrainHandler<
    State extends HydratedGameState & FundingState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly rules: TrainFundingRules,
        private readonly stocks: StockRules,
        private readonly trains: TrainRules,
        private readonly privates: PrivateRules,
        private readonly outOfTurnExchanges: boolean
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
                return ['DeclareBankruptcy']
        }
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        assertExists(state.trainFunding, 'Missing train funding')
        const companyId = state.trainFunding.purchase.companyId
        const president = controllingOwner(state, companyId)
        assertExists(president, 'The company requiring a train has a controlling owner')
        state.trainFunding.playerId = president.playerId
        state.trainFunding.contributors = this.rules.contributors(state, companyId)
        state.activePlayerIds = [state.trainFunding.playerId]
        // Only a sale is the player's to choose; every other step follows from the decision
        // before it, so the engine takes it and one Undo reverses the whole decision.
        const next = new EmergencyTrainFunding(state, this.rules, this.stocks, this.trains).next()
        const settling = settlingFundingAction(next)
        if (settling)
            context.addSystemAction(settling.schema, {
                ...settling.data,
                playerId: state.trainFunding.playerId
            })
        else if (next.kind === 'bankrupt' && !this.exchangeMayAvertBankruptcy(state))
            context.addSystemAction(DeclareBankruptcy, {})
    }
    private exchangeMayAvertBankruptcy(state: State): boolean {
        return state.players.some(
            (player) =>
                (this.outOfTurnExchanges || state.activePlayerIds.includes(player.playerId)) &&
                privateExchangeOffers(state, player.playerId, this.privates, this.stocks).length
        )
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        const state = context.gameState
        if (action instanceof HydratedDeclareBankruptcy)
            return action.metadata?.continuation ?? 'Bankrupt'
        if (action instanceof HydratedBuyTrain) {
            delete state.trainFunding
            if (state.phaseChange) state.phaseChange.continuation.machineState = 'BuyingTrains'
            return state.phaseChange ? 'AdvancingPhase' : 'BuyingTrains'
        }
        return 'FundingTrain'
    }
}

/** The Action taking a funding step that has nothing left to decide; none for a sale or bankruptcy. */
export function settlingFundingAction(choice: FundingChoice):
    | { schema: typeof IssueTreasuryShares; data: Pick<IssueTreasuryShares, 'expectedProceeds'> }
    | { schema: typeof ContributeTrainFunds; data: Pick<ContributeTrainFunds, 'owner' | 'amount'> }
    | {
          schema: typeof BuyTrain
          data: Pick<BuyTrain, 'companyId' | 'trainId' | 'definitionId' | 'expectedPrice'>
      }
    | undefined {
    switch (choice.kind) {
        case 'issue':
            return {
                schema: IssueTreasuryShares,
                data: { expectedProceeds: choice.details.proceeds }
            }
        case 'contribute':
            return {
                schema: ContributeTrainFunds,
                data: { owner: choice.owner, amount: choice.amount }
            }
        case 'buy':
            return {
                schema: BuyTrain,
                data: {
                    companyId: choice.purchase.companyId,
                    trainId: choice.purchase.trainId,
                    definitionId: choice.purchase.definitionId,
                    expectedPrice: choice.purchase.price
                }
            }
        default:
            return undefined
    }
}
