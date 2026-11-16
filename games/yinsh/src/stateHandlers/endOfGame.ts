import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedYinshGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedYinshGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedYinshGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedYinshGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedYinshGameState>) {
        context.gameState.result =
            context.gameState.winningPlayerIds.length > 1 ? GameResult.Draw : GameResult.Win
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedYinshGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
