import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMarracashGameState } from '../model/gameState.js'
import {
    HydratedCompleteAntiqueSet,
    isCompleteAntiqueSet,
    isNextAntiqueSetCompletion
} from '../actions/completeAntiqueSet.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { activateTurnPlayer, finishTurn } from '../util/turns.js'

type EndingTurnAction = HydratedCompleteAntiqueSet | HydratedEndTurn

// The turn's queued antique set completions and its EndTurn run here; no player acts.
export class EndingTurnStateHandler implements MachineStateHandler<
    EndingTurnAction,
    HydratedMarracashGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedMarracashGameState>
    ): action is EndingTurnAction {
        if (isCompleteAntiqueSet(action)) {
            return isNextAntiqueSetCompletion(action, context.gameState)
        }
        return isEndTurn(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedMarracashGameState>) {
        activateTurnPlayer(context.gameState)
    }

    onAction(
        action: EndingTurnAction,
        context: MachineContext<HydratedMarracashGameState>
    ): MachineState {
        switch (true) {
            case isCompleteAntiqueSet(action): {
                return MachineState.EndingTurn
            }
            case isEndTurn(action): {
                return finishTurn(context.gameState)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
