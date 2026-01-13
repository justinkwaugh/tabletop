import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'

// Terminal state
export class EndOfGameStateHandler implements MachineStateHandler<HydratedAction, HydratedKaivaiGameState> {
    isValidAction(_action: HydratedAction, _context: MachineContext<HydratedKaivaiGameState>): boolean {
        return false
    }
    validActionsForPlayer(_playerId: string, _context: MachineContext<HydratedKaivaiGameState>): string[] {
        return []
    }
    enter(context: MachineContext<HydratedKaivaiGameState>): void {
        // Record the end of game data
        const gameState = context.gameState
        const winner = gameState.playersOrderedByAscendingWealth().toReversed()[0]

        context.gameState.result = GameResult.Win
        context.gameState.winningPlayerIds = [winner]
        context.gameState.activePlayerIds = []
    }

    onAction(_action: unknown, _context: MachineContext<HydratedKaivaiGameState>): string {
        throw Error('No actions are valid at the end of the game')
    }
}
