import type { FormationState } from '../company/companyState.js'
import {
    ActionSource,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import { FloatCompany, isFloatCompany } from '../company/floatCompany.js'
import { nextCompanyToFloat } from '../company/companyFlotation.js'
import type { CompanyRules } from '../company/companyRules.js'
import type { StockRules } from '../stock/stockRules.js'
import { isExchangePrivate, isExchangePrivateOutOfTurn } from './exchangePrivate.js'
import {
    evaluatePrivateExchange,
    outOfTurnExchangeOffers,
    privateExchangeOffers
} from './privateExchange.js'
import type { PrivateState, PrivateRules } from './privateRules.js'

export class PrivateExchangeHandler<
    State extends HydratedGameState & PrivateState & FormationState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly rules: PrivateRules,
        private readonly stockRules: StockRules,
        private readonly companyRules: CompanyRules,
        private readonly outOfTurnExchanges: boolean
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const pending = nextCompanyToFloat(context.gameState, this.companyRules)
        if (pending)
            return (
                isFloatCompany(action) &&
                action.source === ActionSource.System &&
                action.companyId === pending.companyId
            )
        if (isExchangePrivate(action))
            return (
                action.source === ActionSource.User &&
                context.gameState.activePlayerIds.includes(action.playerId) &&
                !!evaluatePrivateExchange(context.gameState, action, this.rules, this.stockRules)
                    .details
            )
        if (isExchangePrivateOutOfTurn(action))
            return (
                this.outOfTurnExchanges &&
                action.source === ActionSource.User &&
                outOfTurnExchangeOffers(
                    context.gameState,
                    action.playerId,
                    this.rules,
                    this.stockRules
                ).some(
                    (offer) =>
                        offer.privateCompanyId === action.privateCompanyId &&
                        offer.certificateId === action.certificateId
                )
            )
        if (
            action.source === ActionSource.User &&
            action.playerId !== context.gameState.activePlayerIds[0]
        )
            return false
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        if (nextCompanyToFloat(state, this.companyRules)) return []
        if (!state.activePlayerIds.includes(playerId))
            return this.outOfTurnExchanges &&
                outOfTurnExchangeOffers(state, playerId, this.rules, this.stockRules).length
                ? ['ExchangePrivateOutOfTurn']
                : []
        const ordinary =
            playerId === state.activePlayerIds[0]
                ? this.handler.validActionsForPlayer(playerId, context)
                : []
        return privateExchangeOffers(state, playerId, this.rules, this.stockRules).length
            ? [...ordinary, 'ExchangePrivate']
            : ordinary
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        const companyId =
            state.machineState === 'StockRound' ? undefined : nextOperatingCompany(state)
        const playerId = companyId
            ? controllingOwner(state, companyId)?.playerId
            : (state.turnManager.currentTurn()?.playerId ?? state.activePlayerIds[0])
        assertExists(playerId, 'A decision window requires the ordinary turn owner')
        state.activePlayerIds = [playerId]
        const pending = nextCompanyToFloat(state, this.companyRules)
        if (pending) {
            context.addSystemAction(FloatCompany, { companyId: pending.companyId, playerId })
            return
        }
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return isExchangePrivate(action) ||
            isExchangePrivateOutOfTurn(action) ||
            isFloatCompany(action)
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
