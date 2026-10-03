import { presidentTrainFundingRules } from '@tabletop/18xx'
import { Shikoku1889OperatingRules } from './roundRules.js'
import { Shikoku1889ShareTrading, Shikoku1889StockRules } from './stockRules.js'

export const Shikoku1889TrainFundingRules = presidentTrainFundingRules({
    sellInBlocks: true,
    companyOrder: Shikoku1889OperatingRules.companyOrder,
    saleTerms: Shikoku1889ShareTrading.emergencySaleTerms,
    stockRules: Shikoku1889StockRules,
    protectsPresidency: () => true
})
