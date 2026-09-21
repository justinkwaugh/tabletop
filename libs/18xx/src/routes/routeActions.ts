import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { RouteRules } from './routeEvaluation.js'
import { RunTrains, HydratedRunTrains, isRunTrains } from './runTrains.js'

export function routeActions(rules: RouteRules): ActionDefinition[] {
    return [defineAction(RunTrains, isRunTrains, (action) => new HydratedRunTrains(action, rules))]
}
