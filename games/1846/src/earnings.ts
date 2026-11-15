import { MarketZoneColors1846, Market1846 } from './stock.js'
import {
    payoutJumpEarningsRules,
    EarningsDistribution,
    type EarningsRules,
    type DistributionState
} from '@tabletop/18xx'
import { ReceivershipRules1846 } from './receivership.js'

export const EarningsRules1846: EarningsRules = payoutJumpEarningsRules({
    market: Market1846,
    tripleJumpColor: MarketZoneColors1846.tripleJump
})
export function earningsChoices1846(state: DistributionState) {
    const companyId = state.routeStep?.companyId
    if (!companyId || !state.routeStep?.result || state.earningsDistribution) return []
    const distribution = new EarningsDistribution(state, EarningsRules1846, ReceivershipRules1846)
    return distribution.choices(companyId).flatMap((choice) => {
        const result = distribution.evaluate(companyId, choice)
        return result.details ? [result.details] : []
    })
}
