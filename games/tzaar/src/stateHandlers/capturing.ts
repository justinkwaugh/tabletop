import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedCapture, isCapture } from '../actions/capture.js'
import { HydratedTzaarGameState } from '../model/gameState.js'
import { activateCurrentPlayer, afterCapture, endTurnOf } from './turnFlow.js'

// Rules D and E1: the first move of every turn is a capture.
export class CapturingStateHandler implements MachineStateHandler<
    HydratedCapture,
    HydratedTzaarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedTzaarGameState>
    ): action is HydratedCapture {
        return isCapture(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedTzaarGameState>
    ): ActionType[] {
        return [ActionType.Capture]
    }

    enter(context: MachineContext<HydratedTzaarGameState>) {
        activateCurrentPlayer(context.gameState)
    }

    onAction(
        action: HydratedCapture,
        context: MachineContext<HydratedTzaarGameState>
    ): MachineState {
        const { gameState } = context
        if (action.metadata?.opening || action.metadata?.noSecondMove) {
            return afterCapture(gameState, action, () => endTurnOf(gameState, action.playerId))
        }
        return afterCapture(gameState, action, () => MachineState.SecondMove)
    }
}
