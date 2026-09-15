import { assertExists } from '@tabletop/common'
import { TheOldPrinceOperatingRules } from './roundRules.js'
import {
    companyMarketSpace,
    reorderPendingOperatingCompanies,
    getCompany,
    privateOwner,
    type TrainFundingRules
} from '@tabletop/18xx'
import { TheOldPrinceStockRules } from './stockRules.js'
export const TheOldPrinceTrainFundingRules: TrainFundingRules = {
    afterShareSale(state) {
        reorderPendingOperatingCompanies(state, TheOldPrinceOperatingRules.companyOrder(state))
    },
    includeMarketTrains: false,
    contributors(state, companyId) {
        const president = getCompany(state, companyId).president
        assertExists(president, 'A railway requires its president')
        if (president.kind === 'player') return [president]
        const owner = privateOwner(state, president.companyId)
        assertExists(owner, 'Union Bank requires its owner')
        return [president, owner]
    },
    issuanceTerms(state, companyId, shares) {
        return {
            payer: { kind: 'bank' },
            price: companyMarketSpace(state.stockMarket, companyId).price,
            destinationPoolId: 'market',
            marketLimit: 100,
            maximumShares: shares,
            direction: 'down',
            movement: 1
        }
    },
    saleTerms: (state, companyId, shares, seller) =>
        TheOldPrinceStockRules.saleTerms(state, companyId, shares, seller),
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId,
    requiredSaleShares: () => 0
}
