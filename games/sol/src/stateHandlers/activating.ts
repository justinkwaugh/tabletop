import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedActivateBonus, isActivateBonus } from '../actions/activateBonus.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedActivate, isActivate } from '../actions/activate.js'

// Transition from Activating(Pass) -> Activating | StartOfTurn
// Transition from Activating(ActivateBonus) -> Activating | StartOfTurn

type ActivatingAction = HydratedActivateBonus | HydratedPass | HydratedActivate

export class ActivatingStateHandler implements MachineStateHandler<ActivatingAction> {
    isValidAction(action: HydratedAction, context: MachineContext): action is ActivatingAction {
        if (!action.playerId) return false
        const gameState = context.gameState as HydratedSolGameState

        return (
            isPass(action) ||
            (isActivate(action) && gameState.activation?.currentStationId === undefined) ||
            (isActivateBonus(action) && gameState.activation?.currentStationId !== undefined)
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState

        const validActions = [ActionType.Pass]

        if (!gameState.activation?.currentStationId) {
            validActions.push(ActionType.Activate)
        } else if (
            gameState.activation?.currentStationId &&
            HydratedActivateBonus.canActivateBonus(gameState, playerId)
        ) {
            validActions.push(ActionType.ActivateBonus)
        }

        console.log('Valid activating actions', validActions)
        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: ActivatingAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isActivate(action): {
                return ActivatingStateHandler.handleActivation(gameState, action)
                break
            }
            case isActivateBonus(action): {
                const activation = gameState.activation
                if (!activation) {
                    throw Error('Cannot find activation')
                }

                if (HydratedActivate.canActivate(gameState, activation.playerId)) {
                    activation.currentStationId = undefined
                    activation.currentStationCoords = undefined
                    gameState.activePlayerIds = [activation.playerId]
                    return MachineState.Activating
                } else {
                    gameState.activation = undefined
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.StartOfTurn
                }
                break
            }
            case isPass(action): {
                const activation = gameState.activation
                if (!activation) {
                    throw Error('Cannot find activation')
                }

                if (!activation.currentStationId) {
                    // No more activations chosen
                    gameState.activation = undefined
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.StartOfTurn
                }

                const station = gameState.getActivatingStation()

                if (
                    action.playerId === station.playerId &&
                    activation.playerId !== station.playerId &&
                    HydratedActivateBonus.canActivateBonus(gameState, activation.playerId)
                ) {
                    // Give activating player a chance to do bonus activation
                    gameState.activePlayerIds = [activation.playerId]
                    return MachineState.Activating
                } else if (HydratedActivate.canActivate(gameState, activation.playerId)) {
                    activation.currentStationId = undefined
                    activation.currentStationCoords = undefined
                    gameState.activePlayerIds = [activation.playerId]
                    return MachineState.Activating
                } else {
                    gameState.activation = undefined
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.StartOfTurn
                }
                break
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    static handleActivation(state: HydratedSolGameState, activate: HydratedActivate) {
        const activation = state.activation
        if (!activation) {
            throw Error('Cannot find activation')
        }

        const station = state.getActivatingStation()
        if (HydratedActivateBonus.canActivateBonus(state, station.playerId)) {
            // Give station owner chance to do bonus activation
            state.activePlayerIds = [station.playerId]
            return MachineState.Activating
        } else if (
            activate.playerId !== station.playerId &&
            HydratedActivateBonus.canActivateBonus(state, activate.playerId)
        ) {
            // Give activating player a chance to do bonus activation
            state.activePlayerIds = [activate.playerId]
            return MachineState.Activating
        } else if (HydratedActivate.canActivate(state, activate.playerId)) {
            // Allow activating player to continue if possible
            activation.currentStationId = undefined
            activation.currentStationCoords = undefined
            state.activePlayerIds = [activation.playerId]
            return MachineState.Activating
        } else {
            // No more activations possible, end turn
            state.activation = undefined
            state.turnManager.endTurn(state.actionCount)
            return MachineState.StartOfTurn
        }
    }
}
