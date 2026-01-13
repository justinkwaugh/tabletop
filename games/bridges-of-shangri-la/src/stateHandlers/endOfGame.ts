import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { HydratedBridgesGameState } from '../model/gameState.js'

// Terminal state
export class EndOfGameStateHandler implements MachineStateHandler<HydratedAction, HydratedBridgesGameState> {
    isValidAction(_action: HydratedAction, _context: MachineContext<HydratedBridgesGameState>): boolean {
        return false
    }
    validActionsForPlayer(_playerId: string, _context: MachineContext<HydratedBridgesGameState>): string[] {
        return []
    }
    enter(context: MachineContext<HydratedBridgesGameState>): void {
        // Record the end of game data
        const gameState = context.gameState
        const highScore = Math.max(...gameState.players.map((player) => player.score))
        let winningIds = gameState.players
            .filter((player) => player.score === highScore)
            .map((player) => player.playerId)

        // If there is a tie, the player with the most villages wins
        if (winningIds.length > 1) {
            const mostVillages = Math.max(
                ...winningIds.map((playerId) =>
                    gameState.board.numVillagesOccupiedByPlayer(playerId)
                )
            )
            winningIds = winningIds.filter(
                (playerId) => gameState.board.numVillagesOccupiedByPlayer(playerId) === mostVillages
            )
        }

        context.gameState.result = winningIds.length > 1 ? GameResult.Draw : GameResult.Win
        context.gameState.winningPlayerIds = winningIds
        context.gameState.activePlayerIds = []
    }
    onAction(_action: unknown, _context: MachineContext<HydratedBridgesGameState>): string {
        throw Error('No actions are valid at the end of the game')
    }
}
