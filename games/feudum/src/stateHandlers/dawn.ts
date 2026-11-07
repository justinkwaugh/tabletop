import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { isBeginDawn, type HydratedBeginDawn } from '../actions/beginDawn.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { stateAfterLandscapes } from './replenishing.js'

/** R-4.12 The dawn's scoring and fill. The engine's alone. */
export class DawnStateHandler implements MachineStateHandler<
    HydratedBeginDawn,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedBeginDawn {
        return isBeginDawn(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        context.gameState.activePlayerIds = []
    }

    /** R-4.12.3, D12 Serfs with a filled landscape are asked; with none, the dawn goes on. */
    onAction(
        _action: HydratedBeginDawn,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return context.gameState.flow.landscapes
            ? MachineState.CollectingLandscapes
            : stateAfterLandscapes(context)
    }
}
