import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPunctGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedPunctGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedPunctGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedPunctGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedPunctGameState>) {
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedPunctGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
