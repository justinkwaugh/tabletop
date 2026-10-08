import {
    type GameAction,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type * as Type from 'typebox'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export interface SystemStep {
    schema: Type.TSchema
    matches(action: GameAction): boolean
    next(state: HydratedKoggeGameState): MachineState
}

// A machine state that only waits for its own automatic consequence.
export class SystemStepStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedKoggeGameState
> {
    constructor(private readonly step: SystemStep) {}

    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedKoggeGameState>
    ): boolean {
        return this.step.matches(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedKoggeGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedKoggeGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(this.step.schema)
    }

    onAction(
        _action: HydratedAction,
        context: MachineContext<HydratedKoggeGameState>
    ): MachineState {
        return this.step.next(context.gameState)
    }
}
