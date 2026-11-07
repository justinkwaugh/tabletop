import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-6.3 Terminal: `ScoreGame` recorded the result on the way in. */
export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedFeudumGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        assertExists(context.gameState.result, 'R-6.3 A finished game has its result')
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        throw Error('The game is over')
    }
}
