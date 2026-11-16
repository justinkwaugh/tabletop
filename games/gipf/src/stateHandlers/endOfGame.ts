import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedGipfGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedGipfGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedGipfGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedGipfGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedGipfGameState>) {
        context.gameState.result = GameResult.Win
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedGipfGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
