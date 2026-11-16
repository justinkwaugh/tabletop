import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLyngkGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedLyngkGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedLyngkGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedLyngkGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedLyngkGameState>) {
        context.gameState.result =
            context.gameState.winningPlayerIds.length > 1 ? GameResult.Draw : GameResult.Win
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedLyngkGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
