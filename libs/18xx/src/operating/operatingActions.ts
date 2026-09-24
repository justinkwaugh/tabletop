import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { EndingRules } from '../ending/gameEnding.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { OperatingRules } from './operatingSet.js'
import {
    StartOperatingSet,
    HydratedStartOperatingSet,
    isStartOperatingSet
} from './startOperatingSet.js'
import {
    StartOperatingRound,
    HydratedStartOperatingRound,
    isStartOperatingRound
} from './startOperatingRound.js'
import {
    StartOperatingTurn,
    HydratedStartOperatingTurn,
    isStartOperatingTurn
} from './startOperatingTurn.js'
import {
    FinishOperatingTurn,
    HydratedFinishOperatingTurn,
    isFinishOperatingTurn
} from './finishOperatingTurn.js'

export function operatingActions(
    operating: OperatingRules,
    trains: TrainRules,
    ending: EndingRules
): ActionDefinition[] {
    return [
        defineAction(
            StartOperatingSet,
            isStartOperatingSet,
            (action) => new HydratedStartOperatingSet(action, operating)
        ),
        defineAction(
            StartOperatingRound,
            isStartOperatingRound,
            (action) => new HydratedStartOperatingRound(action, operating, ending)
        ),
        defineAction(
            StartOperatingTurn,
            isStartOperatingTurn,
            (action) => new HydratedStartOperatingTurn(action)
        ),
        defineAction(
            FinishOperatingTurn,
            isFinishOperatingTurn,
            (action) => new HydratedFinishOperatingTurn(action, trains, ending)
        )
    ]
}
