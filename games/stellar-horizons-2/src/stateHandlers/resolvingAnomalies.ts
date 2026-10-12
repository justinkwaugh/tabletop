import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import {
    HydratedResolveAnomaly,
    ResolveAnomaly,
    isResolveAnomaly
} from '../actions/resolveAnomaly.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { stateAfterAnomalies } from './transitions.js'

export class ResolvingAnomaliesStateHandler implements MachineStateHandler<
    HydratedResolveAnomaly,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedResolveAnomaly {
        return isResolveAnomaly(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(ResolveAnomaly)
    }

    onAction(
        _action: HydratedResolveAnomaly,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        return state.pendingAnomalyAttempts.length > 0
            ? MachineState.ResolvingAnomalies
            : stateAfterAnomalies(state)
    }
}
