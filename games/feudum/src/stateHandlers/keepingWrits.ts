import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-4.4.1 The drawer is asked which writs to keep. No Action decides it yet. */
export class KeepingWritsStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedFeudumGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): boolean {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const state = context.gameState
        assertExists(state.flow.writDraw, 'R-4.4.1 Writs have been drawn')
        state.activePlayerIds = [state.flow.writDraw.playerId]
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return MachineState.KeepingWrits
    }
}
