import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedDeliver, isDeliver } from '../actions/deliver.js'
import { isPass } from '../actions/pass.js'

// Transition from Delivering(Deliver) -> Delivering | TakingActions
//                 Delivering(Pass) -> TakingActions
export class DeliveringStateHandler implements MachineStateHandler<HydratedDeliver, HydratedKaivaiGameState> {
    isValidAction(action: HydratedAction, _context: MachineContext<HydratedKaivaiGameState>): action is HydratedDeliver {
        if (!action.playerId) return false
        return action.type === ActionType.Deliver || action.type === ActionType.Pass
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedKaivaiGameState>): ActionType[] {
        const gameState = context.gameState
        const playerState = gameState.getPlayerState(playerId)

        const validActions = [ActionType.Pass]

        // Has another boat to fish with
        for (const boatId of playerState.availableBoats) {
            if (HydratedDeliver.canBoatDeliver({ gameState, playerState, boatId })) {
                validActions.push(ActionType.Deliver)
                break
            }
        }
        return validActions
    }

    enter(_context: MachineContext<HydratedKaivaiGameState>) {}

    onAction(action: HydratedDeliver, context: MachineContext<HydratedKaivaiGameState>): MachineState {
        const gameState = context.gameState
        const playerState = gameState.getPlayerState(action.playerId)

        switch (true) {
            case isDeliver(action): {
                if (
                    playerState.availableBoats.some((boatId) =>
                        HydratedDeliver.canBoatDeliver({ gameState, playerState, boatId })
                    )
                ) {
                    return MachineState.Delivering
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
