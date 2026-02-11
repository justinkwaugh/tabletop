import {
    type HydratedAction,
    type MachineStateHandler,
    assert,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedVroom, isVroom } from '../actions/vroom.js'
import { HydratedBusGameState } from '../model/gameState.js'
import { HydratedPass, isPass, Pass, PassReason } from '../actions/pass.js'
import { getNextActionState } from '../utils/nextActionState.js'

type VroomingAction = HydratedVroom | HydratedPass

export class VroomingStateHandler implements MachineStateHandler<
    VroomingAction,
    HydratedBusGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedBusGameState>
    ): action is VroomingAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isVroom(action) || isPass(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedBusGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions = []

        if (HydratedVroom.canVroom(gameState, playerId)) {
            validActions.push(ActionType.Vroom)
        } else {
            validActions.push(ActionType.Pass)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedBusGameState>) {
        const activePlayerId = context.gameState.vroomAction.at(0)
        assert(activePlayerId, 'No active player for vroom')

        if (!context.gameState.actionsTaken) {
            console.log('Starting vroom turn for player', activePlayerId)
            context.gameState.turnManager.startTurn(activePlayerId, context.gameState.actionCount)
            context.gameState.activePlayerIds = [activePlayerId]
        }

        if (!HydratedVroom.canVroom(context.gameState, activePlayerId)) {
            context.addSystemAction(Pass, {
                playerId: activePlayerId,
                reason: PassReason.CannotVroom
            })
        }
    }

    onAction(action: VroomingAction, context: MachineContext<HydratedBusGameState>): MachineState {
        switch (true) {
            case isVroom(action): {
                const state = context.gameState
                state.actionsTaken += 1
                if (!HydratedVroom.canVroom(context.gameState, action.playerId)) {
                    return this.nextPlayerOrState(context.gameState)
                }
                return MachineState.Vrooming
            }
            case isPass(action): {
                return this.nextPlayerOrState(context.gameState)
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    nextPlayerOrState(state: HydratedBusGameState): MachineState {
        state.vroomTurnsTaken = (state.vroomTurnsTaken ?? 0) + 1
        state.vroomAction.shift()
        state.turnManager.endTurn(state.actionCount)
        state.actionsTaken = 0

        if (state.vroomAction.length === 0) {
            state.vroomTurnsTaken = 0
            return getNextActionState(state)
        }

        return MachineState.Vrooming
    }
}
