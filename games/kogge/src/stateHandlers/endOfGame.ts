import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedKoggeGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedKoggeGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedKoggeGameState>
    ): ActionType[] {
        return []
    }

    // Rulebook: five development points win at once; otherwise the guild master's second
    // lap ends the game and the most victory points win, ties sharing the victory.
    enter(context: MachineContext<HydratedKoggeGameState>) {
        const state = context.gameState
        const developed = state.players.filter((player) => state.hasWon(player.playerId))
        const winners =
            developed.length > 0
                ? developed.map((player) => player.playerId)
                : this.victoryPointLeaders(state)
        state.winningPlayerIds = winners
        state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
        state.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedKoggeGameState>
    ): MachineState {
        throw Error('The game is over')
    }

    private victoryPointLeaders(state: HydratedKoggeGameState): string[] {
        const totals = Object.entries(state.scores()).map(([playerId, score]) => ({
            playerId,
            total: score.total
        }))
        const best = Math.max(...totals.map(({ total }) => total))
        return totals.filter(({ total }) => total === best).map(({ playerId }) => playerId)
    }
}
