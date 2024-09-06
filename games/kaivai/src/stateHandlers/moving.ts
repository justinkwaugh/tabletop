import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedMove, isMove } from '../actions/move.js'
import { isPass } from '../actions/pass.js'

// Transition from Moving(Move) -> Moving | TakingActions
//                 Moving(Pass) -> TakingActions

export class MovingStateHandler implements MachineStateHandler<HydratedMove> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is HydratedMove {
        if (!action.playerId) return false
        return action.type === ActionType.Move || action.type === ActionType.Pass
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedKaivaiGameState
        const playerState = gameState.getPlayerState(playerId)

        const validActions = [ActionType.Pass]

        // Has another boat to fish with
        for (const boatId of playerState.availableBoats) {
            if (HydratedMove.canBoatMove({ gameState, playerState, boatId })) {
                validActions.push(ActionType.Move)
                break
            }
        }
        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: HydratedMove, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedKaivaiGameState
        const playerState = gameState.getPlayerState(action.playerId)

        switch (true) {
            case isMove(action): {
                if (
                    playerState.availableBoats.some((boatId) =>
                        HydratedMove.canBoatMove({ gameState, playerState, boatId })
                    )
                ) {
                    return MachineState.Moving
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
