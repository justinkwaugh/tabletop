import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMarracashGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedMarracashGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedMarracashGameState>
    ): boolean {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedMarracashGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedMarracashGameState>) {
        const gameState = context.gameState
        const winners = gameState.leadingPlayerIds()
        gameState.result = winners.length === 1 ? GameResult.Win : GameResult.Draw
        gameState.winningPlayerIds = winners
        gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedMarracashGameState>
    ): MachineState {
        throw Error('No actions are valid at the end of the game')
    }
}
