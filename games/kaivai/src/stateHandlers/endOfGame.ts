import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'

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
        const gameState = context.gameState as HydratedKaivaiGameState
        const winner = gameState.playersOrderedByAscendingWealth().toReversed()[0]

        context.gameState.result = GameResult.Win
        context.gameState.winningPlayerIds = [winner]
        context.gameState.activePlayerIds = []
    }

    onAction(_action: unknown, _context: MachineContext): string {
        throw Error('No actions are valid at the end of the game')
    }
}
