import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { PrivateRules } from '../privates/privateRules.js'
import type { StockRules } from '../stock/stockRules.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { PhaseRules } from './phaseChange.js'
import { Compile } from 'typebox/compile'
import { HydratedAdvancePhase, advancePhaseSchema, type AdvancePhase } from './advancePhase.js'

export function phaseActions(rules: {
    phaseRules: PhaseRules
    trainRules: TrainRules
    privateRules: PrivateRules
    stockRules: StockRules
}): ActionDefinition[] {
    const changes = rules.phaseRules.changes
    const schema = changes ? advancePhaseSchema(changes.schema) : advancePhaseSchema()
    const validator = Compile(schema)
    return [
        defineAction(
            schema,
            (action): action is AdvancePhase =>
                action.type === 'AdvancePhase' && validator.Check(action),
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
