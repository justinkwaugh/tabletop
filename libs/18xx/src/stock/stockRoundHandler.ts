import { allPlayersPassed } from './stockRoundRules.js'
import { nextCompanyToFloat } from '../company/companyFlotation.js'
import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { isCompleteStockRound, type HydratedCompleteStockRound } from './completeStockRound.js'
import type { HydratedFloatCompany } from '../company/floatCompany.js'
import type { HydratedStartCompany } from '../company/startCompany.js'
import type { CompanyRules } from '../company/companyRules.js'
import type { HydratedBuyShares } from './buyShares.js'
import type { HydratedSellShares } from './sellShares.js'
import type { HydratedFinishStockTurn } from './finishStockTurn.js'
import type { StockRules } from './stockRules.js'
import { CompanyAuctionModel, type CompanyAuctionState } from './companyAuction.js'
import { HydratedAuctionCompany } from './auctionCompany.js'
import { HydratedBidForCompany } from './bidForCompany.js'
import { HydratedPassCompanyAuction } from './passCompanyAuction.js'
import { FormCompany, HydratedFormCompany } from './formCompany.js'
import { OrdinaryStockRoundHandler } from './ordinaryStockRoundHandler.js'
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
    ) {
        this.ordinary = new OrdinaryStockRoundHandler(rules, nextState, companyRules)
    }
    private readonly ordinary: OrdinaryStockRoundHandler
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
        if (action instanceof HydratedAuctionCompany)
            return (
                !allPlayersPassed(state) &&
                !nextCompanyToFloat(state, this.companyRules) &&
                action.source === ActionSource.User &&
                state.activePlayerIds.includes(action.playerId) &&
                action.isValid(state)
            )
        return this.ordinary.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        if (state.companyAuction) return this.auctionActions(state, playerId)
        const actions = this.ordinary.validActionsForPlayer(playerId, context)
        if (
            !state.stockRound.completed &&
            !allPlayersPassed(state) &&
            state.activePlayerIds.includes(playerId) &&
            !nextCompanyToFloat(state, this.companyRules) &&
            this.rules.companyAuction &&
            new CompanyAuctionModel(state, this.rules).canOpen(playerId)
        )
            actions.push('AuctionCompany')
        return actions
    }
    enter(context: MachineContext<State>): void {
        if (context.gameState.companyAuction) this.enterAuction(context)
        else this.ordinary.enter(context)
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
