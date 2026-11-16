import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedDvonnGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedDvonnGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedDvonnGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedDvonnGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedDvonnGameState>) {
        context.gameState.result =
            context.gameState.winningPlayerIds.length > 1 ? GameResult.Draw : GameResult.Win
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedDvonnGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
