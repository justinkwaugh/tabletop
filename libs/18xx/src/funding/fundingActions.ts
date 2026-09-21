import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { StockRules } from '../stock/stockRules.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { TrainFundingRules } from './trainFunding.js'
import { FundTrain, HydratedFundTrain, isFundTrain } from './fundTrain.js'
import {
    IssueTreasuryShares,
    HydratedIssueTreasuryShares,
    isIssueTreasuryShares
} from './issueTreasuryShares.js'
import {
    SellFundingShares,
    HydratedSellFundingShares,
    isSellFundingShares
} from './sellFundingShares.js'
import {
    ContributeTrainFunds,
    HydratedContributeTrainFunds,
    isContributeTrainFunds
} from './contributeTrainFunds.js'
import {
    DeclareBankruptcy,
    HydratedDeclareBankruptcy,
    isDeclareBankruptcy
} from './declareBankruptcy.js'

export function fundingActions(
    funding: TrainFundingRules,
    stock: StockRules,
    trains: TrainRules
): ActionDefinition[] {
    return [
        defineAction(
            FundTrain,
            isFundTrain,
            (action) => new HydratedFundTrain(action, funding, stock, trains)
        ),
        defineAction(
            IssueTreasuryShares,
            isIssueTreasuryShares,
            (action) => new HydratedIssueTreasuryShares(action, funding, stock, trains)
        ),
        defineAction(
            SellFundingShares,
            isSellFundingShares,
            (action) => new HydratedSellFundingShares(action, funding, stock, trains)
        ),
        defineAction(
            ContributeTrainFunds,
            isContributeTrainFunds,
            (action) => new HydratedContributeTrainFunds(action, funding, stock, trains)
        ),
        defineAction(
            DeclareBankruptcy,
            isDeclareBankruptcy,
            (action) => new HydratedDeclareBankruptcy(action, funding, stock, trains)
        )
    ]
}
