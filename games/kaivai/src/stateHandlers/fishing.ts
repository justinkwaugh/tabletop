import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedFish, isFish } from '../actions/fish.js'
import { isPass } from '../actions/pass.js'

// Transition from Fishing(Fish) -> Fishing | TakingActions
//                 Fishing(Pass) -> TakingActions

export class FishingStateHandler implements MachineStateHandler<HydratedFish, HydratedKaivaiGameState> {
    isValidAction(action: HydratedAction, _context: MachineContext<HydratedKaivaiGameState>): action is HydratedFish {
        if (!action.playerId) return false
        return action.type === ActionType.Fish || action.type === ActionType.Pass
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedKaivaiGameState>): ActionType[] {
        const gameState = context.gameState
        const playerState = gameState.getPlayerState(playerId)

        const validActions = [ActionType.Pass]

        // Has another boat to fish with
        for (const boatId of playerState.availableBoats) {
            if (HydratedFish.canBoatFish({ gameState, playerState, boatId })) {
                validActions.push(ActionType.Fish)
                break
            }
        }
        return validActions
    }

    enter(_context: MachineContext<HydratedKaivaiGameState>) {}

    onAction(action: HydratedFish, context: MachineContext<HydratedKaivaiGameState>): MachineState {
        const gameState = context.gameState
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
            case isPass(action): {
                playerState.availableBoats = []
                gameState.turnManager.endTurn(gameState.actionCount)
                return MachineState.TakingActions
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
