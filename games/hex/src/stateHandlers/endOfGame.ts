import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedHexGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedHexGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedHexGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedHexGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedHexGameState>) {
        context.gameState.result = GameResult.Win
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedHexGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
