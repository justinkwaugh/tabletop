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
        const richest = state.players
            .filter((player) => player.cash === best)
            .map((player) => player.playerId)
        const winners = state.map.definition.breakTiesBySharesOfMostValuable
            ? this.mostSharesOfMostValuable(state, richest)
            : richest
        state.winningPlayerIds = winners
        state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
        state.activePlayerIds = []
    }

    // Of the tied players, those holding the most shares of the most valuable railroads.
    private mostSharesOfMostValuable(state: HydratedSarGameState, tied: string[]): string[] {
        const open = state.openRailroads()
        const topValue = Math.max(...open.map((railroad) => state.value(railroad.id)))
        const mostValuable = open.filter((railroad) => state.value(railroad.id) === topValue)
        const shares = (playerId: string) =>
            mostValuable.reduce((sum, railroad) => sum + state.sharesHeld(railroad.id, playerId), 0)
        const most = Math.max(...tied.map(shares))
        return tied.filter((playerId) => shares(playerId) === most)
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedSarGameState>
    ): MachineState {
        throw Error('The game is over')
    }
}
