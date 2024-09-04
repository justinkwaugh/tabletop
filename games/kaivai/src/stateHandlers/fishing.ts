import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedFish, isFish } from '../actions/fish.js'

// Transition from Fishing(Fish) -> Fishing | TakingActions

export class FishingStateHandler implements MachineStateHandler<HydratedFish> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is HydratedFish {
        if (!action.playerId) return false
        return action.type === ActionType.Fish
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedKaivaiGameState
        const playerState = gameState.getPlayerState(playerId)

        const validActions = []

        // Has another boat to fish with
        for (const boatId of playerState.availableBoats) {
            if (HydratedFish.canBoatFish({ gameState, playerState, boatId })) {
                validActions.push(ActionType.Fish)
                break
            }
        }
        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: HydratedFish, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedKaivaiGameState
        const playerState = gameState.getPlayerState(action.playerId)

        switch (true) {
            case isFish(action): {
                if (
                    playerState.availableBoats.some((boatId) =>
                        HydratedFish.canBoatFish({ gameState, playerState, boatId })
                    )
                ) {
                    return MachineState.Fishing
                } else {
                    playerState.availableBoats = []
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.TakingActions
                }
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
