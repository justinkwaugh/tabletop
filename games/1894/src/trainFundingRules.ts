import { presidentTrainFundingRules } from '@tabletop/18xx'
import { EighteenNinetyFourOperatingRules } from './roundRules.js'
import { EighteenNinetyFourShareTrading, EighteenNinetyFourStockRules } from './stockRules.js'

// The president funds a needed train, selling shares as ordinary sales allow, but cannot sell
// away the operating company's presidency (§7.3.7.3).
export const EighteenNinetyFourTrainFundingRules = presidentTrainFundingRules({
    companyOrder: EighteenNinetyFourOperatingRules.companyOrder,
    saleTerms: EighteenNinetyFourShareTrading.emergencySaleTerms,
    stockRules: EighteenNinetyFourStockRules,
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId
})
