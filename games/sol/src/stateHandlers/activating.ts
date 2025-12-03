import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedActivateBonus, isActivateBonus } from '../actions/activateBonus.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedActivate, isActivate } from '../actions/activate.js'
import { drawCardsOrEndTurn } from './postActionHelper.js'
import { Activation } from '../model/activation.js'

// Transition from Activating(Pass) -> Activating | DrawingCards | StartOfTurn
// Transition from Activating(ActivateBonus) -> Activating | DrawingCards | StartOfTurn

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
                return ActivatingStateHandler.handleActivation(gameState, action, context)
                break
            }
            case isActivateBonus(action): {
                const activation = gameState.activation
                if (!activation) {
                    throw Error('Cannot find activation')
                }

                return ActivatingStateHandler.continueActivatingOrEnd(
                    gameState,
                    context,
                    activation
                )
            }
            case isPass(action): {
                const activation = gameState.activation
                if (!activation) {
                    throw Error('Cannot find activation')
                }

                if (!activation.currentStationId) {
                    gameState.activePlayerIds = [activation.playerId]
                    gameState.activation = undefined
                    return drawCardsOrEndTurn(gameState, context)
                }

                const station = gameState.getActivatingStation()
                console.log('Handling pass')
                if (
                    action.playerId === station.playerId &&
                    activation.playerId !== station.playerId &&
                    HydratedActivateBonus.canActivateBonus(gameState, activation.playerId)
                ) {
                    console.log('Giving activating player a chance to do bonus activation')
                    gameState.activePlayerIds = [activation.playerId]
                    return MachineState.Activating
                } else {
                    console.log('Continuing activating or ending turn')
                    return ActivatingStateHandler.continueActivatingOrEnd(
                        gameState,
                        context,
                        activation
                    )
                }
                break
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    static handleActivation(
        state: HydratedSolGameState,
        activate: HydratedActivate,
        context: MachineContext
    ): MachineState {
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
        } else {
            return this.continueActivatingOrEnd(state, context, activation)
        }
    }

    static continueActivatingOrEnd(
        state: HydratedSolGameState,
        context: MachineContext,
        activation: Activation
    ): MachineState {
        if (HydratedActivate.canActivate(state, activation.playerId)) {
            // Allow activating player to continue if possible
            activation.currentStationId = undefined
            activation.currentStationCoords = undefined
            state.activePlayerIds = [activation.playerId]
            return MachineState.Activating
        } else {
            // No more activations possible, end turn
            state.activePlayerIds = [activation.playerId]
            state.activation = undefined
            return drawCardsOrEndTurn(state, context)
        }
    }
}
