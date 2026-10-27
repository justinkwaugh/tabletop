import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'

type Context = MachineContext<HydratedPowerGridGameState>

/**
 * Recharged p. 8: nobody is paid in the final Bureaucracy; whoever could power the most cities
 * wins, ties going to the most money.
 */
export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedPowerGridGameState
> {
    isValidAction(_action: HydratedAction, _context: Context): boolean {
        return false
    }

    validActionsForPlayer(_playerId: string, _context: Context): ActionType[] {
        return []
    }

    enter(context: Context) {
        const state = context.gameState
        if (state.phaseManager.currentPhase) {
            state.phaseManager.endPhase(state.actionCount)
        }
        const [best, ...rest] = state.finalStandings()
        const winners = [best, ...rest]
            .filter(
                (standing) => standing.powered === best.powered && standing.money === best.money
            )
            .map((standing) => standing.playerId)
        state.winningPlayerIds = winners
        state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
        state.activePlayerIds = []
    }

    onAction(_action: HydratedAction, _context: Context): MachineState {
        throw Error('The game is over')
    }
}
