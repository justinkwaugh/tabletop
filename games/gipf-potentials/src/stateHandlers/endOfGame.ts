import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedGipfPotentialsGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedGipfPotentialsGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedGipfPotentialsGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedGipfPotentialsGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedGipfPotentialsGameState>) {
        context.gameState.result = GameResult.Win
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedGipfPotentialsGameState>
    ): MachineState {
        throw Error('No actions valid in EndOfGame state')
    }
}
