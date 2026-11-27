import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedYGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedYGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedYGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedYGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedYGameState>) {
        context.gameState.result = GameResult.Win
        context.gameState.activePlayerIds = []
    }

    onAction(_action: HydratedAction, _context: MachineContext<HydratedYGameState>): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
