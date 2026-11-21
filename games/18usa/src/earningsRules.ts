import {
    dividendEntitlements,
    getCompany,
    type EarningsRules,
    type StockMarket
} from '@tabletop/18xx'
import { MarketPoolId, EighteenUSACompanyMarket } from './marketZones.js'
import { isAcquisitionSpace, EighteenUSAMarket } from './stockMarket.js'

// A company in the acquisition zone is moved as though its price were $40 (BGG rulings).
const AcquisitionZoneComparisonPrice = 40

const DividendMultiples = [0.5, 1, 1.5, 2]

// A 2-share company's single certificate takes its whole distribution, so it is paid as one
// unit; the half pay of a 2-share company is then exact.
const dividendUnits = (shares: number, count: number) => (count === 2 ? shares / 2 : shares)

/** One step for each half of the price the distribution reaches, up to four; none when withheld (§12.5). */
function marketMove(market: StockMarket, companyId: string, distributed: number) {
    const from = EighteenUSAMarket.companySpace(market, companyId)
    const price = isAcquisitionSpace(from) ? AcquisitionZoneComparisonPrice : from.price
    const steps = DividendMultiples.filter(
        (multiple) => distributed >= Math.floor(price * multiple)
    ).length
    const to =
        distributed === 0
            ? EighteenUSAMarket.move(from.id, 'left', 1)
            : EighteenUSAMarket.move(from.id, 'right', steps)
    return { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to.id }
}

export const EighteenUSAEarningsRules: EarningsRules = {
    choices: () => ['pay', 'half-pay', 'withhold'],
    shareCount: (state, companyId) => {
        const count = EighteenUSACompanyMarket.shareCount(state, companyId)
        return dividendUnits(count, count)
    },
    entitlements(state, companyId) {
        const count = EighteenUSACompanyMarket.shareCount(state, companyId)
        return dividendEntitlements(state, companyId, (certificate) =>
            certificate.poolId === MarketPoolId ? undefined : certificate.owner
        ).map((entitlement) => ({
            ...entitlement,
            shares: dividendUnits(entitlement.shares, count)
        }))
    },
    // Half pay retains half the revenue, rounded down to a multiple of the share count, so a
    // 10-share company's shareholders' half rounds up to $10 (§12.5).
    retainedRevenue(state, companyId, choice, revenue) {
        if (choice === 'withhold') return revenue
        if (choice === 'pay') return 0
        const count = EighteenUSACompanyMarket.shareCount(state, companyId)
        return count === 2 ? Math.floor(revenue / 2) : Math.floor(revenue / 2 / count) * count
    },
    roundDividend: (_state, _companyId, amount) => amount,
    marketEffect: (state, companyId, distribution) => ({
        ...(getCompany(state, companyId).floated
            ? {
                  move: marketMove(
                      state.stockMarket,
                      companyId,
                      distribution.revenue - distribution.retained
                  )
              }
            : {}),
        bonusPerShare: 0
    })
}
