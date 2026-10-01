import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedMagnaGreciaGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedMagnaGreciaGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedMagnaGreciaGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedMagnaGreciaGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedMagnaGreciaGameState>) {
        const state = context.gameState
        const totals = Object.entries(state.scores()).map(([playerId, score]) => ({
            playerId,
            total: score.total
        }))
        const best = Math.max(...totals.map(({ total }) => total))
        const winners = totals.filter(({ total }) => total === best).map(({ playerId }) => playerId)
        state.winningPlayerIds = winners
        state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
        state.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedMagnaGreciaGameState>
    ): MachineState {
        throw Error('The game is over')
    }
}
