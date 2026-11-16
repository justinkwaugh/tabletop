import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'

// R-6.1, R-6.2: the game is over and offers nothing more.
export class EndedStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedRideTheRailsGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedRideTheRailsGameState>
    ): boolean {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedRideTheRailsGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedRideTheRailsGameState>) {
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedRideTheRailsGameState>
    ): MachineState {
        throw Error('The game is over')
    }
}
