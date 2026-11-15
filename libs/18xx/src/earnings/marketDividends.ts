import { companyShareCount, type CompanyCharters } from '../company/companyCharters.js'
import { assertExists } from '@tabletop/common'
import type { StockMarketChart } from '../stock/stockMarket.js'
import { dividendEntitlements, type EarningsRules } from './earningsDistribution.js'

/** A company's share count, which a company paying dividends always has. */
export function requiredShareCount(
    state: Parameters<EarningsRules['shareCount']>[0],
    charters: CompanyCharters,
    companyId: string
): number {
    const count = companyShareCount(state, charters, companyId)
    assertExists(count, 'Dividends require a share count')
    return count
}

/** Shares on the initial offering or the company's own pay the company; market shares pay nobody. */
export const marketDividendEntitlements: EarningsRules['entitlements'] = (state, companyId) =>
    dividendEntitlements(state, companyId, (certificate) =>
        certificate.poolId === 'open-market'
            ? undefined
            : certificate.poolId === 'initial-offering'
              ? { kind: 'company', companyId }
              : certificate.owner
    )

/**
 * Pay in full, by half or withhold, moving right, not at all or left: shares on the initial offering
 * or the company's own pay the company, and shares on the market pay the bank.
 */
export function marketDividendEarnings(options: {
    market: StockMarketChart
    charters: CompanyCharters
    /** What a half dividend leaves the company, whose titles round it differently. */
    halfRetained(revenue: number, shareCount: number): number
}): EarningsRules {
    const { market, charters, halfRetained } = options
    const shareCount: EarningsRules['shareCount'] = (state, companyId) =>
        requiredShareCount(state, charters, companyId)
    return {
        choices: () => ['pay', 'half-pay', 'withhold'],
        shareCount,
        entitlements: marketDividendEntitlements,
        retainedRevenue(state, companyId, choice, revenue) {
            if (choice === 'withhold') return revenue
            if (choice === 'pay') return 0
            return halfRetained(revenue, shareCount(state, companyId))
        },
        roundDividend: (_state, _companyId, amount) => amount,
        marketEffect(state, companyId, distribution) {
            if (distribution.choice === 'half-pay') return { bonusPerShare: 0 }
            return {
                move: market.dividendMove(
                    state.stockMarket,
                    companyId,
                    distribution.revenue > distribution.retained
                ),
                bonusPerShare: 0
            }
        }
    }
}
