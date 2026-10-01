import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext,
    assert
} from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'

/** R-3 — the ending action recorded the winner; R-3.3's die is never rolled again (R-X.3). */
export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedOathGameState>
    ): string[] {
        return []
    }

    enter(context: MachineContext<HydratedOathGameState>): void {
        const gameState = context.gameState

        assert(
            gameState.winningPlayerIds.length === 1,
            'R-3 — the action that ended the game records its one winner'
        )
        gameState.result = GameResult.Win
        gameState.activePlayerIds = []
    }

    onAction(_action: HydratedAction, _context: MachineContext<HydratedOathGameState>): string {
        throw Error('No actions are valid at the end of the game')
    }
}
