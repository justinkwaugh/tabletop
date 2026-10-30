import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedTzaarGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedTzaarGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedTzaarGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedTzaarGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedTzaarGameState>) {
        context.gameState.result = GameResult.Win
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedTzaarGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
