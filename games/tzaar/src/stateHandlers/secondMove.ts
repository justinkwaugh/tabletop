import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedCapture, isCapture } from '../actions/capture.js'
import { HydratedStack, isStack } from '../actions/stack.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedTzaarGameState } from '../model/gameState.js'
import { activateCurrentPlayer, afterCapture, endTurnOf } from './turnFlow.js'

type SecondMoveAction = HydratedCapture | HydratedStack | HydratedPass

// Rule E: the second move captures again, strengthens a stack, or passes.
export class SecondMoveStateHandler implements MachineStateHandler<
    SecondMoveAction,
    HydratedTzaarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedTzaarGameState>
    ): action is SecondMoveAction {
        return isCapture(action) || isStack(action) || isPass(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedTzaarGameState>
    ): ActionType[] {
        return [ActionType.Capture, ActionType.Stack, ActionType.Pass]
    }

    enter(context: MachineContext<HydratedTzaarGameState>) {
        activateCurrentPlayer(context.gameState)
    }

    onAction(
        action: SecondMoveAction,
        context: MachineContext<HydratedTzaarGameState>
    ): MachineState {
        const { gameState } = context
        const endTurn = () => endTurnOf(gameState, action.playerId)
        return action instanceof HydratedCapture
            ? afterCapture(gameState, action, endTurn)
            : endTurn()
    }
}
