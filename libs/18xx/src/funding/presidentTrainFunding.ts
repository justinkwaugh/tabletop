import { assertExists } from '@tabletop/common'
import { getCompany, sharesOwned } from '../finance/finance.js'
import { reorderPendingOperatingCompanies, type OperatingRules } from '../operating/operatingSet.js'
import { purchaseOwnershipCeiling, type StockRules } from '../stock/stockRules.js'
import type { TrainFundingRules } from './trainFunding.js'

export function presidentTrainFundingRules(options: {
    companyOrder: OperatingRules['companyOrder']
    saleTerms: TrainFundingRules['saleTerms']
    stockRules: Pick<StockRules, 'ownershipLimit'>
    protectsPresidency: TrainFundingRules['protectsPresidency']
}): TrainFundingRules {
    return {
        afterShareSale(state) {
            reorderPendingOperatingCompanies(state, options.companyOrder(state))
        },
        includeMarketTrains: true,
        contributors(state, companyId) {
            const president = getCompany(state, companyId).president
            assertExists(president, 'A railway requires its president')
            return [president]
        },
        issuanceTerms: () => undefined,
        saleTerms: options.saleTerms,
        protectsPresidency: options.protectsPresidency,
        requiredSaleShares(state, seller, companyId) {
            const company = getCompany(state, companyId)
            if (!company.started || !company.shareCount || company.closed) return 0
            return Math.max(
                0,
                sharesOwned(state, companyId, seller) -
                    purchaseOwnershipCeiling(state, companyId, seller, options.stockRules)
            )
        }
    }
}
