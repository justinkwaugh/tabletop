import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedDickeKartoffelnGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): ActionType[] {
        return []
    }

    // Most winning points wins; the rules name no tiebreak, so tied farmers share the win.
    enter(context: MachineContext<HydratedDickeKartoffelnGameState>) {
        const state = context.gameState
        const standings = state.standings
        assertExists(standings, 'The game ends once it is scored')
        const best = Math.max(...standings.map((standing) => standing.points))
        state.winningPlayerIds = standings
            .filter((standing) => standing.points === best)
            .map((standing) => standing.playerId)
        state.result = state.winningPlayerIds.length > 1 ? GameResult.Draw : GameResult.Win
        state.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): MachineState {
        throw Error('The game is over')
    }
}
