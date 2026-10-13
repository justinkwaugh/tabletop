import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedCompletePhase, isCompletePhase } from '../actions/completePhase.js'
import { HydratedStartPhase, isStartPhase } from '../actions/startPhase.js'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import type { TurnPhase } from '../model/turn.js'
import { playState } from '../model/turnPlan.js'
import { stateAfterPhase } from './transitions.js'

type PhaseAction = HydratedStartPhase | HydratedCompletePhase

export class PhaseStateHandler implements MachineStateHandler<
    PhaseAction,
    HydratedStellarHorizonsGameState
> {
    constructor(private readonly phase: TurnPhase) {}

    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is PhaseAction {
        return isStartPhase(action) || isCompletePhase(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        state.activePlayerIds = state.initiativeOrder()
    }

    onAction(
        action: PhaseAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return isStartPhase(action)
            ? playState(this.phase)
            : stateAfterPhase(context.gameState, this.phase)
    }
}
