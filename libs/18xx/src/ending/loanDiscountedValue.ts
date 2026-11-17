import { getCompany } from '../finance/finance.js'
import type { TitleNames } from '../game/titleNames.js'
import type { StockMarketChart } from '../stock/stockMarket.js'
import { certificateWealthItem, type ValuationRules } from './finalWealth.js'

/**
 * Final values in a title whose loans weigh on the price (1861 §13, 1867 GTG §12.2): a share is
 * worth its price less a space a loan its company owes, a certificate as many shares as it counts
 * (a minor's two), and a private its face value.
 */
export function loanDiscountedValuation(options: {
    market: StockMarketChart
    names: TitleNames
    /** The move each loan takes off the price. */
    leftMove: string
    privateFaceValue(privateId: string): number
}): ValuationRules {
    const { market, names, leftMove, privateFaceValue } = options
    return {
        certificateItems(state, certificate) {
            const company = getCompany(state, certificate.companyId)
            let value = 0
            if (certificate.kind === 'private')
                value = company.closed ? 0 : privateFaceValue(company.id)
            else if (company.started && !company.closed) {
                const from = market.companySpace(state.stockMarket, company.id)
                const price = market.space(
                    market.move(from.id, leftMove, company.loans ?? 0).id
                ).price
                value = price * certificate.shares
            }
            return [certificateWealthItem(names, certificate, value)]
        }
    }
}
