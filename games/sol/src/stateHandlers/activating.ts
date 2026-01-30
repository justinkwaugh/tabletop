import {
    type HydratedAction,
    type MachineStateHandler,
    assertExists,
    MachineContext
} from '@tabletop/common'
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
import { HydratedSacrifice, isSacrifice } from '../actions/sacrifice.js'

// Transition from Activating(Pass) -> Activating | DrawingCards | StartOfTurn
// Transition from Activating(ActivateBonus) -> Activating | DrawingCards | StartOfTurn

type ActivatingAction =
    | HydratedActivateBonus
    | HydratedPass
    | HydratedActivate
    | HydratedActivateEffect
    | HydratedBlight
    | HydratedSacrifice

export class ActivatingStateHandler implements MachineStateHandler<
    ActivatingAction,
    HydratedSolGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedSolGameState>
    ): action is ActivatingAction {
        if (!action.playerId) return false
        const gameState = context.gameState

        return (
            isPass(action) ||
            isActivateEffect(action) ||
            (isBlight(action) && gameState.activeEffect === EffectType.Blight) ||
            isActivate(action) ||
            isActivateBonus(action) ||
            isSacrifice(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSolGameState>
    ): ActionType[] {
        const gameState = context.gameState

        // Maybe need to check activate effect more?
        const validActions = []
        if (gameState.activeEffect !== EffectType.Pulse) {
            validActions.push(ActionType.Pass)
        }

        const turnPlayer = gameState.turnManager.currentTurn()?.playerId
        const myActivation = gameState.getActivationForPlayer(playerId)
        if (turnPlayer === playerId && !myActivation?.currentStationId) {
            validActions.push(ActionType.Activate)
        } else if (HydratedActivateBonus.canActivateBonus(gameState, playerId)) {
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

        if (
            gameState.activeEffect === EffectType.Sacrifice &&
            HydratedSacrifice.canSacrifice(gameState)
        ) {
            validActions.push(ActionType.Sacrifice)
        }

        return validActions
    }

    enter(_context: MachineContext<HydratedSolGameState>) {}

    onAction(
        action: ActivatingAction,
        context: MachineContext<HydratedSolGameState>
    ): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isBlight(action): {
                return drawCardsOrEndTurn(gameState, context)
            }
            case isActivateEffect(action): {
                return onActivateEffect(action, context)
            }
            case isSacrifice(action): {
                return drawCardsOrEndTurn(gameState, context)
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

                return ActivatingStateHandler.handleActivation(gameState, context, action.playerId)
                break
            }
            case isActivateBonus(action): {
                const activation = gameState.getActivationForTurnPlayer()
                assertExists(activation, 'Cannot find activation')

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
                const activation = gameState.getActivationForTurnPlayer()
                assertExists(activation, 'Cannot find activation')

                if (!activation.currentStationId) {
                    gameState.activePlayerIds = [activation.playerId]
                    gameState.removeActivationForPlayer(activation.playerId)
                    return drawCardsOrEndTurn(gameState, context)
                }

                const station = gameState.getActivatingStation(activation.playerId)

                if (
                    action.playerId === station.playerId &&
                    activation.playerId !== station.playerId &&
                    HydratedActivateBonus.canActivateBonus(gameState, activation.playerId)
                ) {
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
        context: MachineContext<HydratedSolGameState>,
        playerId: string
    ): MachineState {
        const activation = state.getActivationForPlayer(playerId)
        assertExists(activation, 'Cannot find activation')

        const station = state.getActivatingStation(playerId)
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
            return this.continueActivatingOrEnd(state, context, activation)
        }
    }

    static continueActivatingOrEnd(
        state: HydratedSolGameState,
        context: MachineContext<HydratedSolGameState>,
        activation: Activation
    ): MachineState {
        // Squeeze ends after one activation
        if (state.activeEffect === EffectType.Squeeze) {
            state.activeEffect = undefined
        }
        if (
            state.machineState !== MachineState.CheckEffect &&
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

        if (
            state.activeEffect !== EffectType.Motivate &&
            HydratedActivate.canActivate(state, activation.playerId)
        ) {
            // Allow activating player to continue if possible
            return MachineState.Activating
        } else {
            // No more activations possible, end turn
            state.removeActivationForPlayer(activation.playerId)
            return drawCardsOrEndTurn(state, context)
        }
    }
}
