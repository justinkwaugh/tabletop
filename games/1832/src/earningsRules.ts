import { assertExists } from '@tabletop/common'
import {
    dividendEntitlements,
    dividendMarketMove,
    getCompany,
    type EarningsRules
} from '@tabletop/18xx'
import { requireEighteenThirtyTwoState } from './state.js'
import { SystemShareCount, isSystem } from './systems.js'

const shareCount = (state: Parameters<EarningsRules['shareCount']>[0], companyId: string) => {
    const count = getCompany(state, companyId).shareCount
    assertExists(count, 'Dividends require a share count')
    return count
}

export const EighteenThirtyTwoEarningsRules: EarningsRules = {
    choices: () => ['pay', 'half-pay', 'withhold'],
    shareCount,
    // Initial-offering and redeemed shares pay the company; open-market shares pay nobody (§9.1.1).
    entitlements: (state, companyId) =>
        dividendEntitlements(state, companyId, (certificate) =>
            certificate.poolId === 'open-market'
                ? undefined
                : certificate.poolId === 'initial-offering'
                  ? { kind: 'company', companyId }
                  : certificate.owner
        ),
    // A half dividend rounds each share's payment up; the company keeps the rest (§9.1.2).
    retainedRevenue(state, companyId, choice, revenue) {
        if (choice === 'withhold') return revenue
        if (choice === 'pay') return 0
        if (isSystem(requireEighteenThirtyTwoState(state), companyId)) return revenue / 2
        const count = shareCount(state, companyId)
        return revenue - Math.ceil(revenue / 2 / count) * count
    },
    roundDividend: (_state, _companyId, amount) => Math.ceil(amount),
    // A System pays each holding its twentieths of the dividend, an odd share rounding up; a half
    // dividend pays half of that, rounded up (§11.6.4).
    holderDividend(state, companyId, { shares, choice, revenue }) {
        if (!isSystem(requireEighteenThirtyTwoState(state), companyId)) return undefined
        const full = Math.ceil((shares * revenue) / SystemShareCount)
        if (choice === 'withhold') return 0
        return choice === 'half-pay' ? Math.ceil(full / 2) : full
    },
    // A full dividend moves right, none (or $0) left, and a half dividend not at all (§9.1.5).
    marketEffect: (state, companyId, distribution) => ({
        ...(distribution.choice === 'half-pay'
            ? {}
            : {
                  move: dividendMarketMove(
                      state.stockMarket,
                      companyId,
                      distribution.revenue > distribution.retained
                  )
              }),
        bonusPerShare: 0
    })
}
