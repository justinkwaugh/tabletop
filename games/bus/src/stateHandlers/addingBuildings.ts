import {
    type HydratedAction,
    type MachineStateHandler,
    assert,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceBuilding, isPlaceBuilding } from '../actions/placeBuilding.js'
import { HydratedBusGameState } from '../model/gameState.js'
import { HydratedPass, isPass, Pass, PassReason } from '../actions/pass.js'
import { getNextActionState } from '../utils/nextActionState.js'

type AddingBuildingsAction = HydratedPlaceBuilding | HydratedPass

export class AddingBuildingsStateHandler implements MachineStateHandler<
    AddingBuildingsAction,
    HydratedBusGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedBusGameState>
    ): action is AddingBuildingsAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isPlaceBuilding(action) || isPass(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedBusGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions = []

        if (HydratedPlaceBuilding.canPlaceBuilding(gameState, playerId)) {
            validActions.push(ActionType.PlaceBuilding)
        } else {
            validActions.push(ActionType.Pass)
        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedBusGameState>) {
        const activePlayerId = context.gameState.buildingAction.at(-1)
        assert(activePlayerId, 'No active player for adding buildings')

        if (!context.gameState.actionsTaken) {
            console.log('Starting add buildings turn for player', activePlayerId)
            context.gameState.turnManager.startTurn(activePlayerId, context.gameState.actionCount)
            context.gameState.activePlayerIds = [activePlayerId]
        }

        const numActions = context.gameState.numAllowedActions()
        console.log('calculated num actions for add buildings:', numActions)
        if (
            numActions === 0 ||
            !HydratedPlaceBuilding.canPlaceBuilding(context.gameState, activePlayerId)
        ) {
            context.addSystemAction(Pass, {
                playerId: activePlayerId,
                reason: PassReason.CannotAddBuildings
            })
        }
    }

    onAction(
        action: AddingBuildingsAction,
        context: MachineContext<HydratedBusGameState>
    ): MachineState {
        const state = context.gameState
        switch (true) {
            case isPlaceBuilding(action): {
                const numActions = context.gameState.numAllowedActions()
                state.actionsTaken += 1

                if (
                    state.actionsTaken === numActions ||
                    !HydratedPlaceBuilding.canPlaceBuilding(context.gameState, action.playerId)
                ) {
                    return this.nextPlayerOrState(state)
                }

                return MachineState.AddingBuildings
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
        state.buildingAction.pop()
        state.turnManager.endTurn(state.actionCount)
        state.actionsTaken = 0

        if (state.buildingAction.length === 0) {
            return getNextActionState(state)
        }

        return MachineState.AddingBuildings
    }
}
