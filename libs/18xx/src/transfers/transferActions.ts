import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { TransferRules } from './purchaseOffer.js'
import {
    OfferPurchase,
    HydratedOfferPurchase,
    RespondToPurchaseOffer,
    HydratedRespondToPurchaseOffer,
    isOfferPurchase,
    isRespondToPurchaseOffer
} from './offerPurchase.js'

export function transferActions(transfers: TransferRules, trains: TrainRules): ActionDefinition[] {
    return [
        defineAction(
            RespondToPurchaseOffer,
            isRespondToPurchaseOffer,
            (action) => new HydratedRespondToPurchaseOffer(action, transfers, trains)
        ),
        defineAction(
            OfferPurchase,
            isOfferPurchase,
            (action) => new HydratedOfferPurchase(action, transfers, trains)
        )
    ]
}
