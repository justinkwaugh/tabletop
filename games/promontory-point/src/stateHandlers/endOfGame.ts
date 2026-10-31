import {
    GameResult,
    assertExists,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { finalTotals, winningPlayerIds } from '../rules/finalTotals.js'
import { gameEndReason } from '../rules/gameEnd.js'

// R-6.1, R-6.2, R-6.2-H1: the game is over; no seat acts again, and every tied leader wins.
export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedPromontoryPointGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedPromontoryPointGameState>) {
        const state = context.gameState
        assertExists(gameEndReason(state), 'The game ends only when the end test holds')
        state.activePlayerIds = []
        // R-6.2, R-6.2-H1: final totals are derived, never written into money; a tie is a draw.
        const winners = winningPlayerIds(finalTotals(state))
        state.winningPlayerIds = winners
        state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): MachineState {
        throw new Error('The game is over')
    }
}
