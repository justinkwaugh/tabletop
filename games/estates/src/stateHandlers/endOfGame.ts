import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'

// Terminal state
export class EndOfGameStateHandler implements MachineStateHandler<HydratedAction, HydratedEstatesGameState> {
    isValidAction(_action: HydratedAction, _context: MachineContext<HydratedEstatesGameState>): boolean {
        return false
    }
    validActionsForPlayer(_playerId: string, _context: MachineContext<HydratedEstatesGameState>): string[] {
        return []
    }
    enter(context: MachineContext<HydratedEstatesGameState>): void {
        // Record the end of game data
        const gameState = context.gameState
        const highScore = Math.max(...gameState.players.map((player) => player.score))
        let winningIds = gameState.players
            .filter((player) => player.score === highScore)
            .map((player) => player.playerId)

        if (winningIds.length > 1) {
            const tiedPlayers = winningIds.map((playerId) => gameState.getPlayerState(playerId))
            const mostMoney = Math.max(...tiedPlayers.map((player) => player.money + player.stolen))
            winningIds = tiedPlayers
                .filter((player) => player.money + player.stolen === mostMoney)
                .map((player) => player.playerId)
        }

        context.gameState.result = winningIds.length > 1 ? GameResult.Draw : GameResult.Win
        context.gameState.winningPlayerIds = winningIds
        context.gameState.activePlayerIds = []
    }
    onAction(_action: unknown, _context: MachineContext<HydratedEstatesGameState>): string {
        throw Error('No actions are valid at the end of the game')
    }
}
