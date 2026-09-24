import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { HydratedSampleGameState } from '../model/gameState.js'

// Terminal state
export class EndOfGameStateHandler implements MachineStateHandler<HydratedAction, HydratedSampleGameState> {
    isValidAction(_action: HydratedAction, _context: MachineContext<HydratedSampleGameState>): boolean {
        // No actions are valid for this state
        return false
    }
    validActionsForPlayer(_playerId: string, _context: MachineContext<HydratedSampleGameState>): string[] {
        // No actions are valid at the end of the game
        return []
    }
    enter(context: MachineContext<HydratedSampleGameState>): void {
        // Record the end of game data
        const gameState = context.gameState

        const winners = gameState.calculateLeadingPlayerIds()
        context.gameState.result = winners.length === 1 ? GameResult.Win : GameResult.Draw
        context.gameState.winningPlayerIds = winners

        // Clear active players as the game is over
        context.gameState.activePlayerIds = []
    }

    onAction(_action: unknown, _context: MachineContext<HydratedSampleGameState>): string {
        throw Error('No actions are valid at the end of the game')
    }
}
