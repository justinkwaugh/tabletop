import { inReceivership } from '@tabletop/18xx'
import { MarketZoneColors1846, Market1846 } from './stock.js'
import {
    dividendEntitlements,
    trainsOwnedBy,
    EarningsDistribution,
    type EarningsRules,
    type DistributionState
} from '@tabletop/18xx'
import { ReceivershipRules1846 } from './receivership.js'

export const EarningsRules1846: EarningsRules = {
    choices: () => ['pay', 'half-pay', 'withhold'],
    shareCount: () => 10,
    entitlements: (state, companyId) =>
        dividendEntitlements(state, companyId, (certificate) => certificate.owner),
    retainedRevenue: (_state, _companyId, choice, revenue) =>
        choice === 'withhold' ? revenue : choice === 'half-pay' ? Math.floor(revenue / 20) * 10 : 0,
    roundDividend: (_state, _companyId, amount) => amount,
    marketEffect(state, companyId, { revenue, retained }) {
        const from = Market1846.companySpace(state.stockMarket, companyId)
        const payout = revenue - retained
        const steps =
            inReceivership(state, companyId) &&
            !trainsOwnedBy(state, { kind: 'company', companyId }).length
                ? -2
                : payout === 0 || payout < from.price / 2
                  ? -1
                  : payout < from.price
                    ? 0
                    : payout < from.price * 2
                      ? 1
                      : from.color === MarketZoneColors1846.tripleJump && payout >= from.price * 3
                        ? 3
                        : 2
        return {
            bonusPerShare: 0,
            ...(steps
                ? {
                      move: {
                          companyId,
                          fromMarketSpaceId: from.id,
                          toMarketSpaceId: Market1846.move(
                              from.id,
                              steps < 0 ? 'left' : 'right',
                              Math.abs(steps)
                          ).id
                      }
                  }
                : {})
        }
    }
}
export function earningsChoices1846(state: DistributionState) {
    const companyId = state.routeStep?.companyId
    if (!companyId || !state.routeStep?.result || state.earningsDistribution) return []
    const distribution = new EarningsDistribution(state, EarningsRules1846, ReceivershipRules1846)
    return distribution.choices(companyId).flatMap((choice) => {
        const result = distribution.evaluate(companyId, choice)
        return result.details ? [result.details] : []
    })
}
