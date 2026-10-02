import { assertExists } from '@tabletop/common'
import {
    companyMarketSpace,
    dividendEntitlements,
    getCompany,
    moveMarketSpace,
    type EarningsRules,
    type StockMarket
} from '@tabletop/18xx'
import { MarketPoolId } from './roundRules.js'
import { isAcquisitionSpace } from './stockMarket.js'

const AcquisitionZoneComparisonPrice = 40

function shareCount(
    state: { companies: readonly { id: string; shareCount?: number }[] },
    id: string
) {
    const count = state.companies.find((company) => company.id === id)?.shareCount
    assertExists(count, 'Dividends require a share count')
    return count
}

// A 2-share company's single certificate takes its whole distribution, so it is paid as one
// unit; the half pay of a 2-share company is then exact.
const dividendUnits = (shares: number, count: number) => (count === 2 ? shares / 2 : shares)

function marketMove(market: StockMarket, companyId: string, distributed: number) {
    const from = companyMarketSpace(market, companyId)
    const price = isAcquisitionSpace(from) ? AcquisitionZoneComparisonPrice : from.price
    const steps = distributed >= price * 2 ? 2 : distributed >= price ? 1 : 0
    const direction = distributed === 0 ? 'left' : 'right'
    const to = moveMarketSpace(market, from.id, direction, distributed === 0 ? 1 : steps)
    return { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to.id }
}

export const EighteenSeventeenEarningsRules: EarningsRules = {
    choices: () => ['pay', 'half-pay', 'withhold'],
    shareCount: (state, companyId) =>
        dividendUnits(shareCount(state, companyId), shareCount(state, companyId)),
    entitlements(state, companyId) {
        const count = shareCount(state, companyId)
        return dividendEntitlements(state, companyId, (certificate) =>
            certificate.poolId === MarketPoolId ? undefined : certificate.owner
        ).map((entitlement) => ({
            ...entitlement,
            shares: dividendUnits(entitlement.shares, count)
        }))
    },
    // Half pay retains half the revenue, rounded down to a multiple of the share count.
    retainedRevenue(state, companyId, choice, revenue) {
        if (choice === 'withhold') return revenue
        if (choice === 'pay') return 0
        const count = shareCount(state, companyId)
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
