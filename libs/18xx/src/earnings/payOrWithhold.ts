import { assertExists } from '@tabletop/common'
import { getCompany } from '../finance/finance.js'
import { dividendMarketMove } from '../stock/stockMarket.js'
import { dividendEntitlements, type EarningsRules } from './earningsDistribution.js'

export function payOrWithholdEarningsRules(pools: {
    unpaidPoolIds: readonly string[]
    companyPoolIds: readonly string[]
}): EarningsRules {
    return {
        choices: () => ['pay', 'withhold'],
        shareCount(state, companyId) {
            const count = getCompany(state, companyId).shareCount
            assertExists(count, 'Dividends require a share count')
            return count
        },
        entitlements: (state, companyId) =>
            dividendEntitlements(state, companyId, (certificate) =>
                certificate.poolId && pools.unpaidPoolIds.includes(certificate.poolId)
                    ? undefined
                    : certificate.poolId && pools.companyPoolIds.includes(certificate.poolId)
                      ? { kind: 'company', companyId }
                      : certificate.owner
            ),
        retainedRevenue: (_state, _companyId, choice, revenue) =>
            choice === 'withhold' ? revenue : 0,
        roundDividend: (_state, _companyId, amount) => amount,
        marketEffect: (state, companyId, distribution) => ({
            ...(getCompany(state, companyId).floated
                ? {
                      move: dividendMarketMove(
                          state.stockMarket,
                          companyId,
                          distribution.baseDividendPerShare > 0
                      )
                  }
                : {}),
            bonusPerShare: 0
        })
    }
}
