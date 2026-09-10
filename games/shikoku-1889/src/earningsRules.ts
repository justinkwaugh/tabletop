import { assertExists } from '@tabletop/common'
import {
    dividendEntitlements,
    dividendMarketMove,
    companyMarketSpace,
    getCompany,
    type EarningsRules
} from '@tabletop/18xx'
export const Shikoku1889EarningsRules: EarningsRules = {
    choices: () => ['pay', 'withhold'],
    shareCount(state, companyId) {
        const count = getCompany(state, companyId).shareCount
        assertExists(count, 'Dividends require a share count')
        return count
    },
    entitlements: (state, companyId) =>
        dividendEntitlements(state, companyId, (certificate) =>
            certificate.poolId === 'initial-offering'
                ? undefined
                : certificate.poolId === 'open-market'
                  ? { kind: 'company', companyId }
                  : certificate.owner
        ),
    retainedRevenue: (_state, _companyId, choice, revenue) => (choice === 'withhold' ? revenue : 0),
    roundDividend: (_state, _companyId, amount) => amount,
    marketEffect: (state, companyId, paying) => ({
        ...(getCompany(state, companyId).floated
            ? { move: dividendMarketMove(state.stockMarket, companyId, paying) }
            : {}),
        bonusPerShare: 0
    })
}
