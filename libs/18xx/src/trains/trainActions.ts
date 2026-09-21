import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { PhaseRules } from '../phases/phaseChange.js'
import type { TrainRules } from './trainPurchase.js'
import { BuyTrain, HydratedBuyTrain, isBuyTrain } from './buyTrain.js'
import { DiscardTrain, HydratedDiscardTrain, isDiscardTrain } from './discardTrain.js'
import { RustTrains, HydratedRustTrains, isRustTrains } from './rustTrains.js'

export function trainActions(trains: TrainRules, phases: PhaseRules): ActionDefinition[] {
    return [
        defineAction(BuyTrain, isBuyTrain, (action) => new HydratedBuyTrain(action, trains)),
        defineAction(
            DiscardTrain,
            isDiscardTrain,
            (action) => new HydratedDiscardTrain(action, trains, phases)
        ),
        defineAction(RustTrains, isRustTrains, (action) => new HydratedRustTrains(action))
    ]
}
