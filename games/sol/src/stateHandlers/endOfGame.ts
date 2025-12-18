import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'

// Terminal state
export class EndOfGameStateHandler implements MachineStateHandler<HydratedAction> {
    isValidAction(_action: HydratedAction, _context: MachineContext): boolean {
        return false
    }
    validActionsForPlayer(_playerId: string, _context: MachineContext): string[] {
        return []
    }
    enter(context: MachineContext): void {
        // Record the end of game data
        const gameState = context.gameState as HydratedSolGameState

        const players = gameState.players.toSorted((a, b) => b.momentum - a.momentum)

        const maxScore = players[0].momentum
        const winners = players.filter((p) => p.momentum === maxScore)

        context.gameState.result = winners.length === 1 ? GameResult.Win : GameResult.Draw
        context.gameState.winningPlayerIds = winners.map((p) => p.playerId)
        context.gameState.activePlayerIds = []
    }

    onAction(_action: unknown, _context: MachineContext): string {
        throw Error('No actions are valid at the end of the game')
    }
}
