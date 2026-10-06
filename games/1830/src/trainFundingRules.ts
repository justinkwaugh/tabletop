import { presidentTrainFundingRules } from '@tabletop/18xx'
import { EighteenThirtyOperatingRules } from './roundRules.js'
import { EighteenThirtyShareTrading, EighteenThirtyStockRules } from './stockRules.js'

export const EighteenThirtyTrainFundingRules = presidentTrainFundingRules({
    sellInBlocks: false,
    companyOrder: EighteenThirtyOperatingRules.companyOrder,
    saleTerms: EighteenThirtyShareTrading.emergencySaleTerms,
    stockRules: EighteenThirtyStockRules,
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId
})
