import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedScoreGame, ScoreGame, isScoreGame } from '../actions/scoreGame.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'

export class FinalScoringStateHandler implements MachineStateHandler<
    HydratedScoreGame,
    HydratedRailheadsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRailheadsGameState>
    ): action is HydratedScoreGame {
        return isScoreGame(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedRailheadsGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedRailheadsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(ScoreGame, {})
    }

    onAction(
        _action: HydratedScoreGame,
        _context: MachineContext<HydratedRailheadsGameState>
    ): MachineState {
        return MachineState.EndOfGame
    }
}
