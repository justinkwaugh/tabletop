import { presidentTrainFundingRules } from '@tabletop/18xx'
import { recordProtectableSale } from './priceProtection.js'
import { EighteenThirtyTwoOperatingRules } from './roundRules.js'
import { EighteenThirtyTwoShareTrading, EighteenThirtyTwoStockRules } from './stockRules.js'

// A president funds a compulsory train from personal cash and share sales that may not change
// the buying company's presidency (§10.6).
export const EighteenThirtyTwoTrainFundingRules = presidentTrainFundingRules({
    sellInBlocks: false,
    companyOrder: EighteenThirtyTwoOperatingRules.companyOrder,
    saleTerms: EighteenThirtyTwoShareTrading.emergencySaleTerms,
    stockRules: EighteenThirtyTwoStockRules,
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId,
    // Presidents may protect shares sold to fund a train too (§5.9, §10.6.2).
    afterShareSale: recordProtectableSale
})
