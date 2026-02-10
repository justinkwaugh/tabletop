import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceBuilding, isPlaceBuilding } from '../actions/placeBuilding.js'
import { HydratedBusGameState } from '../model/gameState.js'

type InitialBuildingPlacementAction = HydratedPlaceBuilding

export class InitialPlacementStateHandler implements MachineStateHandler<
    InitialBuildingPlacementAction,
    HydratedBusGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedBusGameState>
    ): action is InitialBuildingPlacementAction {
        // Leave this comment if you want the template to generate code for valid actions
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedBusGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions = []

        if (HydratedPlaceBuilding.canPlaceBuilding(gameState, playerId)) {
            validActions.push(ActionType.PlaceBuilding)
        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedBusGameState>) {
        const gameState = context.gameState

        if (context.gameState.initialBuildingsPlaced === 0) {
            const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
            gameState.activePlayerIds = [nextPlayerId]
        }
    }

    onAction(
        action: InitialBuildingPlacementAction,
        context: MachineContext<HydratedBusGameState>
    ): MachineState {
        switch (true) {
            case isPlaceBuilding(action): {
                if (context.gameState.initialBuildingsPlaced === 0) {
                    context.gameState.initialBuildingsPlaced = 1
                } else {
                    context.gameState.initialBuildingsPlaced = 0
                }

                
                return MachineState.InitialBuildingPlacement
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
