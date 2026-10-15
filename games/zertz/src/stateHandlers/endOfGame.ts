import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedZertzGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedZertzGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedZertzGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedZertzGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedZertzGameState>) {
        const { gameState } = context
        gameState.result = GameResult.Win
        gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedZertzGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
