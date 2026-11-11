import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedScoreGame, ScoreGame, isScoreGame } from '../actions/scoreGame.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'

export class FinalScoringStateHandler implements MachineStateHandler<
    HydratedScoreGame,
    HydratedDickeKartoffelnGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): action is HydratedScoreGame {
        return isScoreGame(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedDickeKartoffelnGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(ScoreGame, {})
    }

    onAction(
        _action: HydratedScoreGame,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): MachineState {
        return MachineState.EndOfGame
    }
}
