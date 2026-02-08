import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceBuilding, isPlaceBuilding } from '../actions/placeBuilding.js'
import { HydratedBusGameState } from '../model/gameState.js'

type InitialPlacementAction = HydratedPlaceBuilding

export class InitialPlacementStateHandler implements MachineStateHandler<InitialPlacementAction, HydratedBusGameState> {

    isValidAction(action: HydratedAction, context: MachineContext<HydratedBusGameState>): action is InitialPlacementAction {
        // Leave this comment if you want the template to generate code for valid actions
        return false
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedBusGameState>): ActionType[] {
        const gameState = context.gameState

        const validActions = []


        if (HydratedPlaceBuilding.canPlaceBuilding(gameState, playerId)) {

            validActions.push(ActionType.PlaceBuilding)

        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedBusGameState>) {

    }

    onAction(action: InitialPlacementAction, context: MachineContext<HydratedBusGameState>): MachineState {
        switch (true) {
            case isPlaceBuilding(action): {
                return MachineState.InitialPlacement
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
