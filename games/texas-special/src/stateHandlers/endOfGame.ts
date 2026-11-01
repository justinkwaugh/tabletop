import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedSarGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedSarGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedSarGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedSarGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedSarGameState>) {
        const state = context.gameState
        const best = Math.max(...state.players.map((player) => player.cash))
        const winners = state.players
            .filter((player) => player.cash === best)
            .map((player) => player.playerId)
        state.winningPlayerIds = winners
        state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
        state.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedSarGameState>
    ): MachineState {
        throw Error('The game is over')
    }
}
