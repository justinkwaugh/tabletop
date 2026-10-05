import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { TransferRules } from './purchaseOffer.js'
import type { StockRules } from '../stock/stockRules.js'
import {
    OfferPurchase,
    HydratedOfferPurchase,
    RespondToPurchaseOffer,
    OrdinaryOfferPurchase,
    OrdinaryRespondToPurchaseOffer,
    HydratedRespondToPurchaseOffer,
    isOfferPurchase,
    isRespondToPurchaseOffer
} from './offerPurchase.js'

export function transferActions(
    transfers: TransferRules,
    trains: TrainRules,
    stocks: StockRules,
    companyAcquisitions = false
): ActionDefinition[] {
    return [
        defineAction(
            companyAcquisitions ? RespondToPurchaseOffer : OrdinaryRespondToPurchaseOffer,
            isRespondToPurchaseOffer,
            (action) => new HydratedRespondToPurchaseOffer(action, transfers, trains, stocks)
        ),
        defineAction(
            companyAcquisitions ? OfferPurchase : OrdinaryOfferPurchase,
            isOfferPurchase,
            (action) => new HydratedOfferPurchase(action, transfers, trains)
        )
    ]
}
