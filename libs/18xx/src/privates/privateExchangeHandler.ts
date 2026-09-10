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
import { allPlayersPassed } from '../stock/stockRoundRules.js'
import { isExchangePrivate } from './exchangePrivate.js'
import { evaluatePrivateExchange, privateExchangeOffers } from './privateExchange.js'
import type { PrivateState, PrivateRules } from './privateRules.js'

export class PrivateExchangeHandler<
    State extends HydratedGameState & PrivateState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly rules: PrivateRules,
        private readonly stockRules: StockRules,
        private readonly companyRules: CompanyRules
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
                !!evaluatePrivateExchange(context.gameState, action, this.rules, this.stockRules)
                    .details
            )
        if (
            action.source === ActionSource.User &&
            action.playerId !== context.gameState.activePlayerIds[0]
        )
            return false
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        if (nextCompanyToFloat(context.gameState, this.companyRules)) return []
        const ordinary =
            playerId === context.gameState.activePlayerIds[0]
                ? this.handler.validActionsForPlayer(playerId, context)
                : []
        return privateExchangeOffers(context.gameState, playerId, this.rules, this.stockRules)
            .length
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
        if (state.machineState === 'StockRound' && allPlayersPassed(state)) return
        for (const player of state.players) {
            if (
                player.playerId !== playerId &&
                privateExchangeOffers(state, player.playerId, this.rules, this.stockRules).length
            )
                state.activePlayerIds.push(player.playerId)
        }
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return isExchangePrivate(action) || isFloatCompany(action)
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
