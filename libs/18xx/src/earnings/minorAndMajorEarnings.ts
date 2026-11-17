import { getCompany } from '../finance/finance.js'
import { NationalCompanyKind } from '../finance/receivership.js'
import type { CompanyCharters } from '../company/companyCharters.js'
import type { StockMarketChart, StockMarketMove } from '../stock/stockMarket.js'
import { dividendEntitlements, type EarningsRules } from './earningsDistribution.js'
import { requiredShareCount } from './marketDividends.js'

/** Half a major company's earnings paid out, rounded up to a multiple of ten. */
function halfPayment(revenue: number): number {
    return Math.ceil(revenue / 20) * 10
}

/**
 * Earnings in a title of minors, majors and a national company (1861 §10.7, 1867 GTG §8.9): a
 * minor pays half its earnings to its owner and keeps half, moving by its own move, or left when
 * it earns nothing. A major pays out, pays half (keeping half rounded down to ten) or withholds,
 * moving right when the dividends total at least its price and left when it pays nothing.
 * Treasury shares pay the company, market shares no one. The national company keeps everything.
 */
export function minorAndMajorEarnings(options: {
    market: StockMarketChart
    charters: CompanyCharters
    marketPoolId: string
    /** The move a minor makes for earnings. */
    minorRightMove: string
    /** The move a company makes for earning or paying nothing. */
    leftMove: string
}): EarningsRules {
    const { market, charters, marketPoolId, minorRightMove, leftMove } = options
    return {
        choices(state, companyId) {
            const kind = getCompany(state, companyId).kind
            if (kind === NationalCompanyKind) return ['withhold']
            if (kind === 'minor') return ['half-pay']
            return ['pay', 'half-pay', 'withhold']
        },
        // A minor's one certificate takes its whole distribution, so it is paid as one unit.
        shareCount(state, companyId) {
            const kind = getCompany(state, companyId).kind
            if (kind === 'minor' || kind === NationalCompanyKind) return 1
            return requiredShareCount(state, charters, companyId)
        },
        entitlements(state, companyId) {
            const minor = getCompany(state, companyId).kind === 'minor'
            return dividendEntitlements(state, companyId, (certificate) =>
                certificate.poolId === marketPoolId ? undefined : certificate.owner
            ).map((entitlement) => (minor ? { ...entitlement, shares: 1 } : entitlement))
        },
        retainedRevenue(state, companyId, choice, revenue) {
            if (choice === 'withhold') return revenue
            if (choice === 'pay') return 0
            return getCompany(state, companyId).kind === 'minor'
                ? revenue / 2
                : revenue - halfPayment(revenue)
        },
        roundDividend: (_state, _companyId, amount) => amount,
        marketEffect(state, companyId, distribution) {
            const company = getCompany(state, companyId)
            if (company.kind === NationalCompanyKind || !company.floated)
                return { bonusPerShare: 0 }
            const from = market.companySpace(state.stockMarket, companyId)
            const paid = distribution.revenue - distribution.retained
            const move = (direction: string): StockMarketMove | undefined => {
                const to = from.moves[direction]
                return to
                    ? { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to }
                    : undefined
            }
            let marketMove: StockMarketMove | undefined
            if (distribution.revenue === 0 || paid === 0) marketMove = move(leftMove)
            else if (company.kind === 'minor') marketMove = move(minorRightMove)
            else if (distribution.baseDividendPerShare * 10 >= from.price)
                marketMove = market.dividendMove(state.stockMarket, companyId, true)
            return { ...(marketMove ? { move: marketMove } : {}), bonusPerShare: 0 }
        }
    }
}
