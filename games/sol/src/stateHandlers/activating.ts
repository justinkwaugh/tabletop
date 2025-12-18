import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedActivateBonus, isActivateBonus } from '../actions/activateBonus.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedActivate, isActivate } from '../actions/activate.js'
import { drawCardsOrEndTurn, onActivateEffect } from './postActionHelper.js'
import { Activation } from '../model/activation.js'
import { HydratedActivateEffect, isActivateEffect } from '../actions/activateEffect.js'
import { EffectType } from '../components/effects.js'
import { HydratedBlight, isBlight } from '../actions/blight.js'

// Transition from Activating(Pass) -> Activating | DrawingCards | StartOfTurn
// Transition from Activating(ActivateBonus) -> Activating | DrawingCards | StartOfTurn

type ActivatingAction =
    | HydratedActivateBonus
    | HydratedPass
    | HydratedActivate
    | HydratedActivateEffect
    | HydratedBlight

export class ActivatingStateHandler implements MachineStateHandler<ActivatingAction> {
    isValidAction(action: HydratedAction, context: MachineContext): action is ActivatingAction {
        if (!action.playerId) return false
        const gameState = context.gameState as HydratedSolGameState

        return (
            isPass(action) ||
            isActivateEffect(action) ||
            (isBlight(action) && gameState.activeEffect === EffectType.Blight) ||
            (isActivate(action) && gameState.activation?.currentStationId === undefined) ||
            (isActivateBonus(action) && gameState.activation?.currentStationId !== undefined)
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState

        // Maybe need to check activate effect more?
        const validActions = [ActionType.Pass]

        if (!gameState.activation?.currentStationId) {
            validActions.push(ActionType.Activate)
        } else if (
            gameState.activation?.currentStationId &&
            HydratedActivateBonus.canActivateBonus(gameState, playerId)
        ) {
            validActions.push(ActionType.ActivateBonus)
        }

        if (HydratedActivateEffect.canActivateHeldEffect(gameState, playerId)) {
            validActions.push(ActionType.ActivateEffect)
        }

        if (
            gameState.activeEffect === EffectType.Blight &&
            HydratedBlight.canBlight(gameState, playerId)
        ) {
            validActions.push(ActionType.Blight)
        }

        console.log('Valid activating actions', validActions)
        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: ActivatingAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isBlight(action): {
                return drawCardsOrEndTurn(gameState, context)
            }
            case isActivateEffect(action): {
                return onActivateEffect(action, context)
            }
            case isActivate(action): {
                const effects = [EffectType.Augment, EffectType.Squeeze, EffectType.Duplicate]
                if (
                    effects.some((e) =>
                        HydratedActivateEffect.canActivateEffect(gameState, action.playerId, e)
                    )
                ) {
                    return MachineState.CheckEffect
                }

                return ActivatingStateHandler.handleActivation(gameState, context)
                break
            }
            case isActivateBonus(action): {
                const activation = gameState.activation
                if (!activation) {
                    throw Error('Cannot find activation')
                }

                if (
                    HydratedActivateEffect.canActivateEffect(
                        gameState,
                        action.playerId,
                        EffectType.Metamorphosis
                    )
                ) {
                    return MachineState.CheckEffect
                } else if (gameState.activeEffect === EffectType.Metamorphosis) {
                    return MachineState.Metamorphosizing
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
                } else if (
                    HydratedActivateEffect.canActivateEffect(
                        gameState,
                        action.playerId,
                        EffectType.Metamorphosis
                    )
                ) {
                    return MachineState.CheckEffect
                } else if (gameState.activeEffect === EffectType.Metamorphosis) {
                    return MachineState.Metamorphosizing
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

    static handleActivation(state: HydratedSolGameState, context: MachineContext): MachineState {
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
            activation.playerId !== station.playerId &&
            HydratedActivateBonus.canActivateBonus(state, activation.playerId)
        ) {
            // Give activating player a chance to do bonus activation
            state.activePlayerIds = [activation.playerId]
            return MachineState.Activating
        } else {
            console.log('Continuing activating or ending turn')
            return this.continueActivatingOrEnd(state, context, activation)
        }
    }

    static continueActivatingOrEnd(
        state: HydratedSolGameState,
        context: MachineContext,
        activation: Activation
    ): MachineState {
        // Squeeze ends after one activation
        if (state.activeEffect === EffectType.Squeeze) {
            state.activeEffect = undefined
        }
        if (
            HydratedActivateEffect.canActivateEffect(
                state,
                activation.playerId,
                EffectType.Metamorphosis
            )
        ) {
            return MachineState.CheckEffect
        }

        activation.currentStationId = undefined
        activation.currentStationCoords = undefined
        state.activePlayerIds = [activation.playerId]

        if (HydratedActivate.canActivate(state, activation.playerId)) {
            // Allow activating player to continue if possible
            return MachineState.Activating
        } else {
            // No more activations possible, end turn
            state.activation = undefined
            return drawCardsOrEndTurn(state, context)
        }
    }
}
