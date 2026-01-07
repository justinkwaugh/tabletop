import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { HydratedSampleGameState } from '../model/gameState.js'

// Terminal state
export class EndOfGameStateHandler implements MachineStateHandler<HydratedAction> {
    isValidAction(action: HydratedAction, context: MachineContext): boolean {
        // No actions are valid for this state
        return false
    }
    validActionsForPlayer(playerId: string, context: MachineContext): string[] {
        // No actions are valid at the end of the game
        return []
    }
    enter(context: MachineContext): void {
        // Record the end of game data
        const gameState = context.gameState as HydratedSampleGameState

        const winners = gameState.calculateLeadingPlayerIds()
        context.gameState.result = winners.length === 1 ? GameResult.Win : GameResult.Draw
        context.gameState.winningPlayerIds = winners

        // Clear active players as the game is over
        context.gameState.activePlayerIds = []
    }

    onAction(action: unknown, context: MachineContext): string {
        throw Error('No actions are valid at the end of the game')
    }
}
