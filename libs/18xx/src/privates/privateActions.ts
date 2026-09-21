import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { StockRules } from '../stock/stockRules.js'
import type { TrackRules } from '../construction/trackConstruction.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { PrivatePowerRules } from './privatePowers.js'
import type { PrivateRules } from './privateRules.js'
import {
    ContinueOperatingRound,
    HydratedContinueOperatingRound,
    isContinueOperatingRound
} from './betweenCompaniesHandler.js'
import { BuyPrivateTrain, HydratedBuyPrivateTrain, isBuyPrivateTrain } from './buyPrivateTrain.js'
import {
    DeclinePrivateTile,
    HydratedDeclinePrivateTile,
    LayPrivateTile,
    HydratedLayPrivateTile,
    isDeclinePrivateTile,
    isLayPrivateTile
} from './layPrivateTile.js'
import { ExchangePrivate, HydratedExchangePrivate, isExchangePrivate } from './exchangePrivate.js'

export function privateActions(rules: {
    privateRules: PrivateRules
    privatePowerRules: PrivatePowerRules
    stockRules: StockRules
    trackRules: TrackRules
    trainRules: TrainRules
}): ActionDefinition[] {
    return [
        defineAction(
            ContinueOperatingRound,
            isContinueOperatingRound,
            (action) => new HydratedContinueOperatingRound(action)
        ),
        defineAction(
            BuyPrivateTrain,
            isBuyPrivateTrain,
            (action) =>
                new HydratedBuyPrivateTrain(action, rules.privatePowerRules, rules.trainRules)
        ),
        defineAction(
            DeclinePrivateTile,
            isDeclinePrivateTile,
            (action) => new HydratedDeclinePrivateTile(action)
        ),
        defineAction(
            LayPrivateTile,
            isLayPrivateTile,
            (action) =>
                new HydratedLayPrivateTile(action, rules.privatePowerRules, rules.trackRules)
        ),
        defineAction(
            ExchangePrivate,
            isExchangePrivate,
            (action) => new HydratedExchangePrivate(action, rules.privateRules, rules.stockRules)
        )
    ]
}
