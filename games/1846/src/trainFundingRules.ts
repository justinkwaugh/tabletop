import {
    issueFirstTrainFunding,
    type IssuingCorporations,
    type TrainFundingRules,
    type TrainPurchaseDetails
} from '@tabletop/18xx'
import { Elimination1846 } from './bankruptcy.js'
import { OperatingRules1846 } from './operating.js'
import { Market1846, StockRules1846 } from './stock.js'

export const IssuingCorporations1846: IssuingCorporations = {
    market: Market1846,
    marketPoolId: 'open-market',
    issuanceFloor: 20
}

/** GMT §§6.86–6.89. */
export const TrainFundingRules1846: TrainFundingRules = issueFirstTrainFunding(
    IssuingCorporations1846,
    {
        stockRules: StockRules1846,
        companyOrder: (state) => OperatingRules1846.companyOrder(state),
        elimination: Elimination1846
    }
)
export type { TrainPurchaseDetails }
