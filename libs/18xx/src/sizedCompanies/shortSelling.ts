import {
    ActionSource,
    assert,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { systemEvent, titleAction, type SystemEventSchema } from '../actions/titleAction.js'
import { companyShareCount } from '../company/companyCharters.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { getCompany, sharesOwned, treasuryPoolId, type OpenShare } from '../finance/finance.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { SystemActionFirstHandler } from '../game/systemActionFirstHandler.js'
import { cancelShorts, openShort, openShorts, ordinaryShares } from '../stock/shorts.js'
import { recordStockRoundSale } from '../stock/stockRound.js'
import { recordStockAction } from '../stock/stockRoundRules.js'
import type { StockRules } from '../stock/stockRules.js'
import { canStartStockRound } from '../stock/startStockRound.js'
import type { SizedCompanyMarket } from './sizedCompanyMarket.js'
import type { HydratedSizedCompanyState, SizedCompanyState } from './sizedCompanyState.js'

/** A title's terms for short selling its companies' shares. */
export interface ShortSellingRules {
    market: SizedCompanyMarket
    stockRules: StockRules
    /** The most shorts that may stand on the company at once. */
    maximumShorts(state: SizedCompanyState, companyId: string): number
    /** The phases in which no short may be opened. */
    closedPhaseIds: readonly string[]
}

const ShortShareAction = titleAction('ShortShare', {
    companyId: Type.String(),
    expectedPrice: Type.Integer({ minimum: 1 }),
    metadata: Type.Optional(
        Type.Object(
            { shareId: Type.String(), shortId: Type.String(), payment: CashPayment },
            { additionalProperties: false }
        )
    )
})
export const ShortShare = ShortShareAction.schema
export type ShortShare = Type.Static<typeof ShortShare>
export const isShortShare = ShortShareAction.is

const CloseMarketShortsFields = {
    companyId: Type.String(),
    metadata: Type.Optional(
        Type.Object(
            { closed: Type.Integer({ minimum: 1 }), payments: Type.Array(CashPayment) },
            { additionalProperties: false }
        )
    )
}
const CloseMarketShortsAction = systemEvent('CloseMarketShorts', CloseMarketShortsFields)
export const CloseMarketShorts: SystemEventSchema<
    'CloseMarketShorts',
    typeof CloseMarketShortsFields
> = CloseMarketShortsAction.schema
export type CloseMarketShorts = Type.Static<typeof CloseMarketShorts>
export const isCloseMarketShorts = CloseMarketShortsAction.is

/**
 * Selling a company short in the stock round, and the bank's buyout of the market's own shorts
 * as each stock round begins.
 */
export class ShortSelling {
    constructor(readonly rules: ShortSellingRules) {}

    shortReason(state: SizedCompanyState, playerId: string, companyId: string): string | undefined {
        const { market } = this.rules
        const turn = state.stockRound.turn
        if (
            state.machineState !== 'StockRound' ||
            state.companyAuction ||
            !state.activePlayerIds.includes(playerId)
        )
            return 'It is not this player’s stock turn.'
        if (turn.bought || turn.shorted || turn.corporateAction)
            return 'A short must come before any purchase, once a turn.'
        const company = getCompany(state, companyId)
        const shareCount = companyShareCount(state, market.rules.charters, companyId)
        if (
            !shareCount ||
            shareCount <= market.rules.charterShareCount ||
            !company.floated ||
            !company.operated
        )
            return 'Only an operated company of more than two shares can be shorted.'
        if (this.rules.closedPhaseIds.includes(state.phaseId))
            return `No shorts can be opened in phase ${state.phaseId}.`
        if (market.inClosingZone(state.stockMarket, companyId))
            return 'Companies in the acquisition or liquidation zone cannot be shorted.'
        if (sharesOwned(state, companyId, { kind: 'player', playerId }) > 0)
            return 'A player holding shares of a company cannot short it.'
        if (openShorts(state, companyId).length >= this.rules.maximumShorts(state, companyId))
            return 'This company has as many shorts as it may.'
        return undefined
    }

    shortOptions(
        state: SizedCompanyState,
        playerId: string
    ): { companyId: string; price: number }[] {
        return state.companies
            .filter(
                (company) =>
                    company.kind !== 'private' &&
                    company.started &&
                    !this.shortReason(state, playerId, company.id)
            )
            .map((company) => ({
                companyId: company.id,
                price: this.rules.market.price(state, company.id)
            }))
    }

    private shortValid(state: SizedCompanyState, action: ShortShare): boolean {
        return (
            !this.shortReason(state, action.playerId, action.companyId) &&
            this.rules.market.price(state, action.companyId) === action.expectedPrice
        )
    }

    /**
     * The company whose market shorts the bank closes as a stock round begins, by buying its
     * treasury shares for the market, outside the closing zones.
     */
    marketShortToBuyOut(state: SizedCompanyState): string | undefined {
        const { market } = this.rules
        if (!canStartStockRound(state)) return undefined
        const pool = market.marketPool(state)
        return state.companies.find(
            (company) =>
                openShorts(state, company.id, pool.owner).length > 0 &&
                !market.inClosingZone(state.stockMarket, company.id) &&
                this.treasuryShares(state, company.id).length > 0
        )?.id
    }

    private treasuryShares(state: SizedCompanyState, companyId: string): OpenShare[] {
        return ordinaryShares(state, companyId).filter(
            (share) => share.poolId === treasuryPoolId(companyId)
        )
    }

    actions(): ActionDefinition[] {
        return ShortSelling.actionsOf(this)
    }

    private static actionsOf(selling: ShortSelling): ActionDefinition[] {
        const { market, stockRules } = selling.rules
        class HydratedShortShare extends ShortShareAction.Base implements ShortShare {
            declare type: 'ShortShare'
            declare playerId: string
            declare companyId: string
            declare expectedPrice: number
            declare metadata?: ShortShare['metadata']
            apply(state: HydratedGameState & SizedCompanyState): void {
                assert(
                    this.source === ActionSource.User && selling.shortValid(state, this),
                    selling.shortReason(state, this.playerId, this.companyId) ??
                        'The share price has changed'
                )
                const player = { kind: 'player' as const, playerId: this.playerId }
                const pool = market.marketPool(state)
                const { shareId, shortId } = openShort(state, this.companyId, player, pool)
                const payment = {
                    from: { kind: 'bank' as const },
                    to: player,
                    amount: this.expectedPrice
                }
                settleCashPayments(state, [payment])
                recordStockRoundSale(state.stockRound, player, this.companyId)
                state.stockRound.turn.shorted = true
                recordStockAction(state, this.playerId, stockRules.round)
                this.metadata = { shareId, shortId, payment }
            }
        }
        class HydratedCloseMarketShorts
            extends CloseMarketShortsAction.Base
            implements CloseMarketShorts
        {
            declare type: 'CloseMarketShorts'
            declare companyId: string
            declare metadata?: CloseMarketShorts['metadata']
            apply(state: HydratedGameState & SizedCompanyState): void {
                assert(
                    this.source === ActionSource.System &&
                        selling.marketShortToBuyOut(state) === this.companyId,
                    'The bank closes the market’s shorts as a stock round begins'
                )
                const pool = market.marketPool(state)
                const shorts = openShorts(state, this.companyId, pool.owner).length
                const price = market.price(state, this.companyId)
                const bought = selling.treasuryShares(state, this.companyId).slice(0, shorts)
                const payments = bought.map(() => ({
                    from: { kind: 'bank' as const },
                    to: { kind: 'company' as const, companyId: this.companyId },
                    amount: price
                }))
                settleCashPayments(state, payments)
                for (const share of bought) {
                    share.owner = { ...pool.owner }
                    share.poolId = pool.id
                }
                this.metadata = {
                    closed: cancelShorts(state, this.companyId, pool.owner),
                    payments
                }
            }
        }
        return [
            ShortShareAction.define((action) => new HydratedShortShare(action)),
            CloseMarketShortsAction.define((action) => new HydratedCloseMarketShorts(action))
        ]
    }

    /** Offers a short on the player's stock turn alongside their other choices. */
    shortsInStockRound<S extends HydratedSizedCompanyState>(
        handler: EighteenXXStateHandler<S>
    ): EighteenXXStateHandler<S> {
        return {
            isValidAction: (action: HydratedAction, context: MachineContext<S>): boolean =>
                isShortShare(action)
                    ? action.source === ActionSource.User &&
                      this.shortValid(context.gameState, action)
                    : handler.isValidAction(action, context),
            validActionsForPlayer: (playerId: string, context: MachineContext<S>): string[] => {
                const actions = handler.validActionsForPlayer(playerId, context)
                return actions.includes('FinishStockTurn') &&
                    this.shortOptions(context.gameState, playerId).length
                    ? [...actions, 'ShortShare']
                    : actions
            },
            enter: (context: MachineContext<S>): void => handler.enter(context),
            onAction: (action: HydratedAction, context: MachineContext<S>): string =>
                isShortShare(action) ? 'StockRound' : handler.onAction(action, context)
        }
    }

    /** As a stock round begins the bank closes the market's shorts it can. */
    buysOutMarketShorts<S extends HydratedSizedCompanyState>(
        handler: EighteenXXStateHandler<S>
    ): EighteenXXStateHandler<S> {
        return new SystemActionFirstHandler(handler, CloseMarketShorts, (state) => {
            const companyId = this.marketShortToBuyOut(state)
            return companyId ? { companyId } : undefined
        })
    }
}
