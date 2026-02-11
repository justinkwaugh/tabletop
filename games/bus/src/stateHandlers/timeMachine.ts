import {
    type HydratedAction,
    type MachineStateHandler,
    assert,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedStopTime, isStopTime } from '../actions/stopTime.js'
import { HydratedBusGameState } from '../model/gameState.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { getNextActionState } from '../utils/nextActionState.js'
import { isRotateTime, RotateTime } from 'src/actions/rotateTime.js'

type TimeMachineAction = HydratedStopTime | HydratedPass

export class TimeMachineStateHandler implements MachineStateHandler<
    TimeMachineAction,
    HydratedBusGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedBusGameState>
    ): action is TimeMachineAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isStopTime(action) || isPass(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedBusGameState>
    ): ActionType[] {
        return [ActionType.StopTime, ActionType.Pass]
    }

    enter(context: MachineContext<HydratedBusGameState>) {
        const activePlayerId = context.gameState.clockAction

        if (!activePlayerId) {
            // Time passes
            context.addSystemAction(RotateTime)
        } else {
            context.gameState.turnManager.startTurn(activePlayerId, context.gameState.actionCount)
            context.gameState.activePlayerIds = [activePlayerId]
        }
    }

    onAction(
        action: TimeMachineAction,
        context: MachineContext<HydratedBusGameState>
    ): MachineState {
        const state = context.gameState
        switch (true) {
            case isStopTime(action):
            case isPass(action): {
                state.clockAction = undefined
                state.turnManager.endTurn(state.actionCount)
                return getNextActionState(state)
            }
            case isRotateTime(action): {
                return getNextActionState(state)
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
