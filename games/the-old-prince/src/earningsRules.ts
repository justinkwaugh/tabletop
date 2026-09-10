import { assertExists } from '@tabletop/common'
import {
    dividendEntitlements,
    dividendMarketMove,
    companyMarketSpace,
    getCompany,
    type EarningsRules
} from '@tabletop/18xx'
import { peirShares } from './finance.js'
export const TheOldPrinceEarningsRules: EarningsRules = {
    choices: (_state, companyId) =>
        companyId === 'PEIR' ? ['pay', 'half-pay', 'withhold'] : ['pay', 'withhold'],
    shareCount(state, companyId) {
        if (companyId === 'PEIR') return peirShares(state).length
        const count = getCompany(state, companyId).shareCount
        assertExists(count, 'Dividends require a share count')
        return count
    },
    entitlements: (state, companyId) =>
        dividendEntitlements(state, companyId, (certificate) =>
            certificate.owner.kind === 'bank' ? { kind: 'company', companyId } : certificate.owner
        ),
    retainedRevenue: (_state, _companyId, choice, revenue) =>
        choice === 'withhold' ? revenue : choice === 'half-pay' ? Math.ceil(revenue / 2) : 0,
    roundDividend: (_state, companyId, amount) =>
        companyId === 'PEIR' ? Math.ceil(amount) : amount,
    marketEffect(state, companyId, paying) {
        if (companyId === 'PEIR' || !getCompany(state, companyId).floated)
            return { bonusPerShare: 0 }
        return {
            move: dividendMarketMove(state.stockMarket, companyId, paying),
            bonusPerShare:
                paying && companyMarketSpace(state.stockMarket, companyId).price === 400 ? 40 : 0
        }
    }
}
