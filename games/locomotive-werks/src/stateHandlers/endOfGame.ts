import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedLwGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedLwGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedLwGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedLwGameState>
    ): ActionType[] {
        return []
    }

    // The richest player wins; tied players win together.
    enter(context: MachineContext<HydratedLwGameState>) {
        const state = context.gameState
        const best = state.richest()
        const winners = state.players
            .filter((player) => player.cash === best)
            .map((player) => player.playerId)
        state.winningPlayerIds = winners
        state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
        state.activePlayerIds = []
    }

    onAction(_action: HydratedAction, _context: MachineContext<HydratedLwGameState>): MachineState {
        throw Error('The game is over')
    }
}
