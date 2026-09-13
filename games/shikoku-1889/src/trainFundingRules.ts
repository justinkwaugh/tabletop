import { assertExists } from '@tabletop/common'
import {
    companyMarketSpace,
    getCompany,
    sharesOwned,
    reorderPendingOperatingCompanies,
    type TrainFundingRules
} from '@tabletop/18xx'
import { Shikoku1889OperatingRules } from './roundRules.js'
export const Shikoku1889TrainFundingRules: TrainFundingRules = {
    afterShareSale(state) {
        reorderPendingOperatingCompanies(state, Shikoku1889OperatingRules.companyOrder(state))
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
        return {
            payer: { kind: 'bank' },
            price: companyMarketSpace(state.stockMarket, companyId).price,
            destinationPoolId: 'open-market',
            marketLimit: 50,
            maximumShares: company.shareCount,
            movement: shares
        }
    },
    protectsPresidency: () => true,
    requiredSaleShares(state, seller, companyId) {
        const company = getCompany(state, companyId)
        if (
            !company.started ||
            !company.shareCount ||
            company.closed ||
            companyMarketSpace(state.stockMarket, companyId).color === 'orange'
        )
            return 0
        return Math.max(
            0,
            sharesOwned(state, companyId, seller) - Math.floor(company.shareCount * 0.6)
        )
    }
}
