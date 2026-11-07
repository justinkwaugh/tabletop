import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { isEndRound, type HydratedEndRound } from '../actions/endRound.js'
import { isScoreGame, ScoreGame, type HydratedScoreGame } from '../actions/scoreGame.js'
import { StartRound } from '../actions/startRound.js'
import { LastEpoch } from '../data/tracks.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

type EndOfRoundAction = HydratedEndRound | HydratedScoreGame

/** R-2.2.5 Step 5 of the round, and at V final scoring (R-6.1). The engine's alone. */
export class EndOfRoundStateHandler implements MachineStateHandler<
    EndOfRoundAction,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedFeudumGameState>
    ): action is EndOfRoundAction {
        return isEndRound(action) || (isScoreGame(action) && context.gameState.epoch === LastEpoch)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        context.gameState.activePlayerIds = []
    }

    /** R-2.2 The next round begins; R-6.1, R-6.1-H1 after the V dawn the game is scored instead. */
    onAction(
        action: EndOfRoundAction,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        if (isScoreGame(action)) {
            return MachineState.EndOfGame
        }
        if (context.gameState.epoch === LastEpoch) {
            context.addSystemAction(ScoreGame)
            return MachineState.EndOfRound
        }
        context.addSystemAction(StartRound)
        return MachineState.SelectingHands
    }
}
