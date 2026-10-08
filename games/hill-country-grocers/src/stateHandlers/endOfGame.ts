import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedHcgGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedHcgGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedHcgGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedHcgGameState>
    ): ActionType[] {
        return []
    }

    // Most money wins; a tie goes to whoever holds fewer shares, and is otherwise shared.
    enter(context: MachineContext<HydratedHcgGameState>) {
        const state = context.gameState
        const best = Math.max(...state.players.map((player) => player.cash))
        const richest = state.players.filter((player) => player.cash === best)
        const fewest = Math.min(...richest.map((player) => state.totalShares(player.playerId)))
        const winners = richest
            .filter((player) => state.totalShares(player.playerId) === fewest)
            .map((player) => player.playerId)
        state.winningPlayerIds = winners
        state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
        state.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedHcgGameState>
    ): MachineState {
        throw Error('The game is over')
    }
}
