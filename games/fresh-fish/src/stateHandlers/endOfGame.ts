import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState'

// Terminal state
export class EndOfGameStateHandler implements MachineStateHandler<HydratedAction, HydratedFreshFishGameState> {
    isValidAction(_action: HydratedAction, _context: MachineContext<HydratedFreshFishGameState>): boolean {
        return false
    }
    validActionsForPlayer(_playerId: string, _context: MachineContext<HydratedFreshFishGameState>): string[] {
        return []
    }
    enter(context: MachineContext<HydratedFreshFishGameState>): void {
        // Record the end of game data
        const gameState = context.gameState
        gameState.score()
        const highScore = Math.max(...gameState.players.map((player) => player.score))
        const winningIds = gameState.players
            .filter((player) => player.score === highScore)
            .map((player) => player.playerId)
        context.gameState.result = winningIds.length > 1 ? GameResult.Draw : GameResult.Win
        context.gameState.winningPlayerIds = winningIds
    }
    onAction(_action: unknown, _context: MachineContext<HydratedFreshFishGameState>): string {
        throw Error('No actions are valid at the end of the game')
    }
}
