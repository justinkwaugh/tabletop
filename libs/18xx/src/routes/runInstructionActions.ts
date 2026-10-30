import type { GameAction } from '@tabletop/common'
import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { RouteRules } from './routeEvaluation.js'
import {
    HydratedSetRunInstruction,
    SetRunInstruction,
    isSetRunInstruction
} from './setRunInstruction.js'
import {
    HydratedSetRunInstructionStops,
    SetRunInstructionStops,
    isSetRunInstructionStops
} from './setRunInstructionStops.js'
import {
    HydratedStopRunInstruction,
    StopRunInstruction,
    isStopRunInstruction
} from './stopRunInstruction.js'

export function runInstructionActions(rules: RouteRules): ActionDefinition[] {
    return [
        defineAction(
            SetRunInstruction,
            isSetRunInstruction,
            (action) => new HydratedSetRunInstruction(action, rules)
        ),
        defineAction(
            SetRunInstructionStops,
            isSetRunInstructionStops,
            (action) => new HydratedSetRunInstructionStops(action)
        ),
        defineAction(
            StopRunInstruction,
            isStopRunInstruction,
            (action) => new HydratedStopRunInstruction(action)
        )
    ]
}

export function isRunInstructionDeclaration(action: GameAction): boolean {
    return isSetRunInstruction(action) || isSetRunInstructionStops(action)
}

/** Declarations and stops: bookkeeping that history does not show. */
export function isRunInstructionAction(action: GameAction): boolean {
    return isRunInstructionDeclaration(action) || isStopRunInstruction(action)
}
