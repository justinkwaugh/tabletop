import {
    CompleteStockRound,
    isCompleteStockRound,
    type HydratedCompleteStockRound
} from './completeStockRound.js'
import { allPlayersPassed } from './stockRoundRules.js'
import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { FloatCompany, isFloatCompany, type HydratedFloatCompany } from '../company/floatCompany.js'
import { isStartCompany, type HydratedStartCompany } from '../company/startCompany.js'
import { evaluateCompanyStart } from '../company/companyStart.js'
import { nextCompanyToFloat } from '../company/companyFlotation.js'
import type { CompanyRules } from '../company/companyRules.js'
import { sharesOwned } from '../finance/finance.js'
import { isBuyShares, type HydratedBuyShares } from './buyShares.js'
import { HydratedOfferPrivatePurchase, privateSaleChoices } from './privateSale.js'
import { isSellShares, type HydratedSellShares } from './sellShares.js'
import { isFinishStockTurn, type HydratedFinishStockTurn } from './finishStockTurn.js'
import { evaluateSharePurchase } from './sharePurchase.js'
import { evaluateShareSale } from './shareSale.js'
import { exceedsStockLimits, type StockRules } from './stockRules.js'
import { CompanyAuctionModel, type CompanyAuctionState } from './companyAuction.js'
import { HydratedAuctionCompany } from './auctionCompany.js'
import { HydratedBidForCompany } from './bidForCompany.js'
import { HydratedPassCompanyAuction } from './passCompanyAuction.js'
import { FormCompany, HydratedFormCompany } from './formCompany.js'

type State = HydratedGameState & CompanyAuctionState
type Action =
    | HydratedAuctionCompany
    | HydratedBidForCompany
    | HydratedPassCompanyAuction
    | HydratedFormCompany
    | HydratedBuyShares
    | HydratedSellShares
    | HydratedFinishStockTurn
    | HydratedStartCompany
    | HydratedFloatCompany
    | HydratedCompleteStockRound
export class StockRoundHandler implements MachineStateHandler<Action, State> {
    constructor(
        private readonly rules: StockRules,
        private readonly nextState: string,
        private readonly companyRules: CompanyRules
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        if (state.stockRound.completed) return false
        if (state.companyAuction)
            return (
                (action instanceof HydratedBidForCompany ||
                    action instanceof HydratedPassCompanyAuction ||
                    action instanceof HydratedFormCompany) &&
                action.isValid(state)
            )
        if (isCompleteStockRound(action))
            return (
                action.source === ActionSource.System &&
                allPlayersPassed(state) &&
                !state.turnManager.currentTurn() &&
                !nextCompanyToFloat(state, this.companyRules)
            )
        if (allPlayersPassed(state)) return false
        if (isFloatCompany(action))
            return (
                action.source === ActionSource.System &&
                nextCompanyToFloat(state, this.companyRules)?.companyId === action.companyId
            )
        if (nextCompanyToFloat(state, this.companyRules)) return false
        if (
            action.source !== ActionSource.User ||
            !action.playerId ||
            !state.activePlayerIds.includes(action.playerId)
        )
            return false
        if (action instanceof HydratedOfferPrivatePurchase) return action.isValid(state)
        if (action instanceof HydratedAuctionCompany) return action.isValid(state)
        if (isStartCompany(action))
            return (
                action.expectedPrice ===
                evaluateCompanyStart(state, action, this.rules, this.companyRules).details?.price
            )
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
        if (state.companyAuction) return this.auctionActions(state, playerId)
        if (
            state.stockRound.completed ||
            allPlayersPassed(state) ||
            !state.activePlayerIds.includes(playerId) ||
            nextCompanyToFloat(state, this.companyRules)
        )
            return []
        const actions: string[] = []
        if (
            this.rules.buyers(state, playerId).some((buyer) =>
                state.companies.some(
                    (company) =>
                        !company.started &&
                        this.companyRules.startMarketSpaces(state, company.id).some(
                            (marketSpaceId) =>
                                evaluateCompanyStart(
                                    state,
                                    {
                                        playerId,
                                        buyer,
                                        companyId: company.id,
                                        marketSpaceId
                                    },
                                    this.rules,
                                    this.companyRules
                                ).details
                        )
                )
            )
        )
            actions.push('StartCompany')
        if (
            this.rules.companyAuction &&
            new CompanyAuctionModel(state, this.rules).canOpen(playerId)
        )
            actions.push('AuctionCompany')
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
        if (privateSaleChoices(state, this.rules, playerId).length)
            actions.push('OfferPrivatePurchase')
        if (!exceedsStockLimits(state, { kind: 'player', playerId }, this.rules))
            actions.push('FinishStockTurn')
        return actions
    }
    enter(context: MachineContext<State>): void {
        if (context.gameState.companyAuction) {
            this.enterAuction(context)
            return
        }
        if (allPlayersPassed(context.gameState)) {
            context.addSystemAction(CompleteStockRound, {
                playerId: context.gameState.activePlayerIds[0]
            })
            return
        }
        const details = nextCompanyToFloat(context.gameState, this.companyRules)
        if (details)
            context.addSystemAction(FloatCompany, {
                companyId: details.companyId,
                playerId: context.gameState.activePlayerIds[0]
            })
    }
    onAction(action: Action, context: MachineContext<State>): string {
        return isCompleteStockRound(action) ? this.nextState : context.gameState.machineState
    }
    private auctionActions(state: State, playerId: string): string[] {
        const model = new CompanyAuctionModel(state, this.rules)
        if (model.playerId !== playerId) return []
        if (model.pendingFormation()) return ['FormCompany']
        return [
            'PassCompanyAuction',
            ...(model.lowestBid(playerId) !== undefined ? ['BidForCompany'] : [])
        ]
    }
    private enterAuction(context: MachineContext<State>): void {
        const state = context.gameState
        const model = new CompanyAuctionModel(state, this.rules)
        const playerId = model.playerId
        if (playerId) state.activePlayerIds = [playerId]
        const pending = model.pendingFormation()
        const choice = model.automaticFormation()
        if (pending && choice)
            context.addSystemAction(FormCompany, {
                playerId: pending.playerId,
                companyId: pending.companyId,
                ...choice
            })
    }
}
