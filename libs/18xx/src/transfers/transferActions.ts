import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { TransferRules } from './purchaseOffer.js'
import type { StockRules } from '../stock/stockRules.js'
import {
    OfferPurchase,
    HydratedOfferPurchase,
    RespondToPurchaseOffer,
    HydratedRespondToPurchaseOffer,
    isOfferPurchase,
    isRespondToPurchaseOffer
} from './offerPurchase.js'

export function transferActions(
    transfers: TransferRules,
    trains: TrainRules,
    stocks: StockRules
): ActionDefinition[] {
    return [
        defineAction(
            RespondToPurchaseOffer,
            isRespondToPurchaseOffer,
            (action) => new HydratedRespondToPurchaseOffer(action, transfers, trains, stocks)
        ),
        defineAction(
            OfferPurchase,
            isOfferPurchase,
            (action) => new HydratedOfferPurchase(action, transfers, trains)
        )
    ]
}
