import { sharesOwned, type Owner } from '../finance/finance.js'
import { evaluateShareDisposal } from './shareSale.js'
import type { StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

export function shareSaleValue(state: StockState, owner: Owner, rules: StockRules): number {
    return state.companies.reduce((total, company) => {
        if (company.closed) return total
        const owned = sharesOwned(state, company.id, owner)
        let maximum = 0
        for (let shares = 1; shares <= owned; shares++) {
            const result = evaluateShareDisposal(
                state,
                owner,
                [{ companyId: company.id, shares }],
                rules
            )
            if (result.details) maximum = Math.max(maximum, result.details.proceeds)
        }
        return total + maximum
    }, 0)
}
