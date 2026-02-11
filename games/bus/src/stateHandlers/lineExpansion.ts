import {
    type HydratedAction,
    type MachineStateHandler,
    assert,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceBusLine, isPlaceBusLine } from '../actions/placeBusLine.js'
import { HydratedBusGameState } from '../model/gameState.js'
import { isPass, Pass, PassReason } from '../actions/pass.js'
import { getNextActionState } from '../utils/nextActionState.js'

type LineExpansionAction = HydratedPlaceBusLine

export class LineExpansionStateHandler implements MachineStateHandler<
    LineExpansionAction,
    HydratedBusGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedBusGameState>
    ): action is LineExpansionAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isPlaceBusLine(action) || isPass(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedBusGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions = []

        if (HydratedPlaceBusLine.canPlaceBusLine(gameState, playerId)) {
            validActions.push(ActionType.PlaceBusLine)
        } else {
            validActions.push(ActionType.Pass)
        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedBusGameState>) {
        const activePlayerId = context.gameState.lineExpansionAction.at(-1)
        assert(activePlayerId, 'No active player for line expansion')

        if (!context.gameState.actionsTaken) {
            console.log('Starting line expansion turn for player', activePlayerId)
            context.gameState.turnManager.startTurn(activePlayerId, context.gameState.actionCount)
            context.gameState.activePlayerIds = [activePlayerId]
        }

        const numActions = context.gameState.numAllowedActions()
        console.log('calculated num actions for line expansion:', numActions)
        if (
            numActions === 0 ||
            !HydratedPlaceBusLine.canPlaceBusLine(context.gameState, activePlayerId)
        ) {
            context.addSystemAction(Pass, {
                playerId: activePlayerId,
                reason: PassReason.CannotExpandLine
            })
        }
    }

    onAction(
        action: LineExpansionAction,
        context: MachineContext<HydratedBusGameState>
    ): MachineState {
        const state = context.gameState
        switch (true) {
            case isPlaceBusLine(action): {
                const numActions = context.gameState.numAllowedActions()
                state.actionsTaken += 1

                if (
                    state.actionsTaken === numActions ||
                    !HydratedPlaceBusLine.canPlaceBusLine(context.gameState, action.playerId)
                ) {
                    return this.nextPlayerOrState(state)
                }

                return MachineState.LineExpansion
            }
            case isPass(action): {
                return this.nextPlayerOrState(state)
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    nextPlayerOrState(state: HydratedBusGameState): MachineState {
        state.lineExpansionAction.pop()
        state.turnManager.endTurn(state.actionCount)
        state.actionsTaken = 0

        if (state.lineExpansionAction.length === 0) {
            return getNextActionState(state)
        }

        return MachineState.LineExpansion
    }
}
