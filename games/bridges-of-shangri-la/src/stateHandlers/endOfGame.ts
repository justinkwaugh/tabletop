import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { HydratedBridgesGameState } from '../model/gameState.js'

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
        const gameState = context.gameState as HydratedBridgesGameState
        const highScore = Math.max(...gameState.players.map((player) => player.score))
        const winningIds = gameState.players
            .filter((player) => player.score === highScore)
            .map((player) => player.playerId)

        const tiedHighScore = Math.max(
            ...gameState.players.map((player) =>
                gameState.board.numVillagesOccupiedByPlayer(player.playerId)
            )
        )
        winningIds.filter(
            (playerId) => gameState.board.numVillagesOccupiedByPlayer(playerId) === tiedHighScore
        )

        context.gameState.result = winningIds.length > 1 ? GameResult.Draw : GameResult.Win
        context.gameState.winningPlayerIds = winningIds
        context.gameState.activePlayerIds = []
    }
    onAction(_action: unknown, _context: MachineContext): string {
        throw Error('No actions are valid at the end of the game')
    }
}
