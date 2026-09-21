import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { PrivateRules } from '../privates/privateRules.js'
import type { StockRules } from '../stock/stockRules.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { PhaseRules } from './phaseChange.js'
import { AdvancePhase, HydratedAdvancePhase, isAdvancePhase } from './advancePhase.js'

export function phaseActions(rules: {
    phaseRules: PhaseRules
    trainRules: TrainRules
    privateRules: PrivateRules
    stockRules: StockRules
}): ActionDefinition[] {
    return [
        defineAction(
            AdvancePhase,
            isAdvancePhase,
            (action) =>
                new HydratedAdvancePhase(
                    action,
                    rules.phaseRules,
                    rules.trainRules,
                    rules.privateRules,
                    rules.stockRules
                )
        )
    ]
}
