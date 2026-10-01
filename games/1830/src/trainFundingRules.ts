import { assertExists } from '@tabletop/common'
import {
    companyMarketSpace,
    getCompany,
    sharesOwned,
    reorderPendingOperatingCompanies,
    type TrainFundingRules
} from '@tabletop/18xx'
import { EighteenThirtyOperatingRules } from './roundRules.js'
import { eighteenThirtySaleTerms } from './stockRules.js'
export const EighteenThirtyTrainFundingRules: TrainFundingRules = {
    afterShareSale(state) {
        reorderPendingOperatingCompanies(state, EighteenThirtyOperatingRules.companyOrder(state))
    },
    includeMarketTrains: true,
    contributors(state, companyId) {
        const president = getCompany(state, companyId).president
        assertExists(president, 'A railway requires its president')
        return [president]
    },
    issuanceTerms: () => undefined,
    saleTerms(state, companyId, shares) {
        const company = getCompany(state, companyId)
        if (!company.shareCount || !company.president || company.closed)
            return 'This company has no saleable shares.'
        return eighteenThirtySaleTerms(state, companyId, company.shareCount, shares)
    },
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId,
    requiredSaleShares(state, seller, companyId) {
        const company = getCompany(state, companyId)
        if (
            !company.started ||
            !company.shareCount ||
            company.closed ||
            ['orange', 'brown'].includes(companyMarketSpace(state.stockMarket, companyId).color)
        )
            return 0
        return Math.max(
            0,
            sharesOwned(state, companyId, seller) - Math.floor(company.shareCount * 0.6)
        )
    }
}
