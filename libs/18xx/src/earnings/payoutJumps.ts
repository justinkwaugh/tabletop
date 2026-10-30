import { inReceivership } from '../finance/receivership.js'
import type { StockMarketChart, StockMarketMove } from '../stock/stockMarket.js'
import { trainsOwnedBy } from '../trains/train.js'
import {
    dividendEntitlements,
    type DistributionState,
    type DistributionSummary,
    type EarningsRules
} from './earningsDistribution.js'

export type PayoutJumpMarket = {
    market: StockMarketChart
    /** The zone whose prices move three spaces for a payout of at least three times the price. */
    tripleJumpColor: string
}

/**
 * Moves a one-row market by the payout against the price: left below half, none below the
 * price, one right below double, two right from double, three in the triple-jump zone from
 * triple. A receiver without trains moves two left.
 */
export function payoutJumpSteps(
    { market, tripleJumpColor }: PayoutJumpMarket,
    state: DistributionState,
    companyId: string,
    { revenue, retained }: Pick<DistributionSummary, 'revenue' | 'retained'>
): number {
    const from = market.companySpace(state.stockMarket, companyId)
    const payout = revenue - retained
    if (
        inReceivership(state, companyId) &&
        !trainsOwnedBy(state, { kind: 'company', companyId }).length
    )
        return -2
    if (payout === 0 || payout < from.price / 2) return -1
    if (payout < from.price) return 0
    if (payout < from.price * 2) return 1
    return from.color === tripleJumpColor && payout >= from.price * 3 ? 3 : 2
}

export function payoutJumpMarketEffect(
    jumps: PayoutJumpMarket,
    state: DistributionState,
    companyId: string,
    distribution: DistributionSummary
): { move?: StockMarketMove; bonusPerShare: number } {
    const steps = payoutJumpSteps(jumps, state, companyId, distribution)
    if (!steps) return { bonusPerShare: 0 }
    const from = jumps.market.companySpace(state.stockMarket, companyId)
    return {
        bonusPerShare: 0,
        move: {
            companyId,
            fromMarketSpaceId: from.id,
            toMarketSpaceId: jumps.market.move(
                from.id,
                steps < 0 ? 'left' : 'right',
                Math.abs(steps)
            ).id
        }
    }
}

/**
 * Pay, half-pay or withhold, every holder including the treasury paid per share, half-pay
 * retaining half rounded down to $10, and the market moved by payout jumps.
 */
export function payoutJumpEarningsRules(jumps: PayoutJumpMarket): EarningsRules {
    return {
        choices: () => ['pay', 'half-pay', 'withhold'],
        shareCount: () => 10,
        entitlements: (state, companyId) =>
            dividendEntitlements(state, companyId, (certificate) => certificate.owner),
        retainedRevenue: (_state, _companyId, choice, revenue) =>
            choice === 'withhold'
                ? revenue
                : choice === 'half-pay'
                  ? Math.floor(revenue / 20) * 10
                  : 0,
        roundDividend: (_state, _companyId, amount) => amount,
        marketEffect: (state, companyId, distribution) =>
            payoutJumpMarketEffect(jumps, state, companyId, distribution)
    }
}
