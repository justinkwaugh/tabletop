import {
    assertExists,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { gameEndReason } from '../rules/gameEnd.js'

// R-6.1, R-6.2: the game is over; no seat acts again.
export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedPromontoryPointGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedPromontoryPointGameState>) {
        const state = context.gameState
        assertExists(gameEndReason(state), 'The game ends only when the end test holds')
        state.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): MachineState {
        throw new Error('The game is over')
    }
}
