import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMatrxGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedMatrxGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedMatrxGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedMatrxGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedMatrxGameState>) {
        context.gameState.result = GameResult.Win
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedMatrxGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
