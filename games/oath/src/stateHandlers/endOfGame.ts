import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext,
    assert
} from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { writesChronicle } from '../util/chronicle.js'

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
        // R-8 — in a game that writes its chronicle the result comes once the chronicle is
        // written, and with it the next game may continue this one. A tournament game's result
        // comes at the win, and nothing continues it (R-8-H1).
        if (writesChronicle(gameState)) {
            assert(
                gameState.chronicle !== undefined && gameState.chronicle.step === undefined,
                'R-8 — the result waits on the last step of the chronicle'
            )
            gameState.canContinue = true
        }
        gameState.activePlayerIds = []
    }

    onAction(_action: HydratedAction, _context: MachineContext<HydratedOathGameState>): string {
        throw Error('No actions are valid at the end of the game')
    }
}
