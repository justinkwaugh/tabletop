import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedActivateBonus, isActivateBonus } from '../actions/activateBonus.js'
import { HydratedPass, isPass } from '../actions/pass.js'

// Transition from Activating(Pass) -> Activating | StartOfTurn
// Transition from Activating(ActivateBonus) -> StartOfTurn

type ActivatingAction = HydratedActivateBonus | HydratedPass

export class ActivatingStateHandler implements MachineStateHandler<ActivatingAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is ActivatingAction {
        if (!action.playerId) return false
        return action.type === ActionType.ActivateBonus || action.type === ActionType.Pass
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState

        const validActions = [ActionType.Pass]

        if (HydratedActivateBonus.canActivateBonus(gameState, playerId)) {
            validActions.push(ActionType.ActivateBonus)
        }

        console.log('Valid activating actions', validActions)
        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: ActivatingAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isActivateBonus(action): {
                gameState.activatingStationId = undefined
                gameState.activatingStationRing = undefined
                gameState.turnManager.endTurn(gameState.actionCount)
                return MachineState.StartOfTurn
            }
            case isPass(action): {
                const station = gameState.getActivatingStation()
                const activatingPlayerId = gameState.turnManager.currentTurn()?.playerId
                if (!activatingPlayerId) {
                    throw Error('Cannot find activating player id')
                }

                if (action.playerId === activatingPlayerId) {
                    gameState.activatingStationId = undefined
                    gameState.activatingStationRing = undefined
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.StartOfTurn
                } else if (
                    action.playerId === station.playerId &&
                    HydratedActivateBonus.canActivateBonus(gameState, activatingPlayerId)
                ) {
                    gameState.activePlayerIds = [activatingPlayerId]
                    return MachineState.Activating
                }

                gameState.activatingStationId = undefined
                gameState.activatingStationRing = undefined
                gameState.turnManager.endTurn(gameState.actionCount)
                return MachineState.StartOfTurn
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
