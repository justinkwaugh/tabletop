import type { StockMarketChart } from '../stock/stockMarket.js'
import type { CorporateFinanceRules, FinanceChoice } from './corporateFinance.js'
import {
    certificateShares,
    certificatesInPool,
    finiteCashOwnedBy,
    getCompany,
    treasuryPoolId
} from './finance.js'

/**
 * A major company may buy back any of its shares from the market pool at the current price, from
 * its treasury alone, before it runs its trains (1861 §10.3, 1867 GTG §8.5).
 */
export function poolRedemptionFinance(options: {
    market: StockMarketChart
    marketPoolId: string
}): CorporateFinanceRules {
    const { market, marketPoolId } = options
    const certificates: CorporateFinanceRules['certificates'] = (state, companyId) =>
        certificatesInPool(state, marketPoolId).filter(
            (certificate) => certificate.companyId === companyId
        )
    return {
        timing: 'before-running',
        certificates,
        destinationPool: (companyId) => treasuryPoolId(companyId),
        choices(state, companyId) {
            if (getCompany(state, companyId).kind !== 'major') return []
            const pool = certificates(state, companyId, 'redeem')
            const price = market.companySpace(state.stockMarket, companyId).price
            const cash = finiteCashOwnedBy(state, { kind: 'company', companyId })
            const choices: FinanceChoice[] = []
            let shares = 0
            for (const certificate of pool) {
                shares += certificateShares(certificate)
                if (shares * price > cash) break
                choices.push({ companyId, operation: 'redeem', shares, amount: shares * price })
            }
            return choices
        }
    }
}
