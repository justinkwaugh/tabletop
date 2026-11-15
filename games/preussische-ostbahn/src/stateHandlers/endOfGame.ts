import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOstbahnGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedOstbahnGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedOstbahnGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedOstbahnGameState>) {
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedOstbahnGameState>
    ): MachineState {
        throw Error('The game is over')
    }
}
