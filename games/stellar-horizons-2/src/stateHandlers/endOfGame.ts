import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(): boolean {
        return false
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        state.activePlayerIds = []
        state.result = this.result(state.winningPlayerIds.length)
    }

    onAction(): MachineState {
        throw Error('The game is over')
    }

    private result(winnerCount: number): GameResult {
        if (winnerCount === 0) {
            return GameResult.Loss
        }
        return winnerCount > 1 ? GameResult.Draw : GameResult.Win
    }
}
