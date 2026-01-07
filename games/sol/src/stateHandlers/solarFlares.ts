import {
    type HydratedAction,
    type MachineStateHandler,
    ActionSource,
    assert,
    assertExists,
    MachineContext,
    Prng
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedSolarFlare, isSolarFlare, SolarFlare } from '../actions/solarFlare.js'
import { HydratedActivate, isActivate } from '../actions/activate.js'
import { Ring } from '../utils/solGraph.js'
import { nanoid } from 'nanoid'
import { Activation } from '../model/activation.js'
import { HydratedPass, isPass, Pass } from '../actions/pass.js'
import { HydratedActivateEffect, isActivateEffect } from '../actions/activateEffect.js'
import { EffectType } from '../components/effects.js'
import { onActivateEffect } from './postActionHelper.js'

// Transition from SolarFlares(SolarFlare) -> SolarFlares | ChoosingCard
// Transition from SolarFlares(Activate) -> SolarFlares | ChoosingCard
// Transition from SolarFlares(Pass) -> SolarFlares | ChoosingCard
// Transition from SolarFlares(ActivateEffect) -> SolarFlares

type SolarFlaresActions =
    | HydratedPass
    | HydratedSolarFlare
    | HydratedActivate
    | HydratedActivateEffect

export class SolarFlaresStateHandler implements MachineStateHandler<SolarFlaresActions> {
    isValidAction(action: HydratedAction, context: MachineContext): action is SolarFlaresActions {
        return (
            isSolarFlare(action) || isActivate(action) || isPass(action) || isActivateEffect(action)
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState
        const validActions = [ActionType.Pass, ActionType.Activate]
        if (HydratedActivateEffect.canActivateHeldEffect(gameState, playerId)) {
            validActions.push(ActionType.ActivateEffect)
        }

        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: SolarFlaresActions, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isActivateEffect(action): {
                return onActivateEffect(action, context)
            }
            case isSolarFlare(action): {
                const activatingPlayerIds = gameState.players
                    .filter((ps) => {
                        const stations = gameState.board.stationsInRing(Ring.Outer, ps.playerId)
                        return stations.some((station) =>
                            HydratedActivate.canActivateStationAt(
                                gameState,
                                ps.playerId,
                                station.coords!
                            )
                        )
                    })
                    .map((ps) => ps.playerId)

                const activations = activatingPlayerIds.map((playerId) => {
                    return {
                        playerId: playerId,
                        activatedIds: []
                    } satisfies Activation
                })

                if (activations.length > 0) {
                    gameState.activations = activations

                    gameState.solarFlareActivationsGroupId = action.id
                    gameState.activePlayerIds = activatingPlayerIds
                    return MachineState.SolarFlares
                } else {
                    return SolarFlaresStateHandler.continueSolarFlaresOrEnd(gameState, context)
                }
                break
            }
            case isActivate(action): {
                const activation = gameState.getActivationForPlayer(action.playerId)
                assertExists(activation, 'Cannot find activation for activating player')

                activation.currentStationId = undefined
                activation.currentStationCoords = undefined

                if (HydratedActivate.canActivate(gameState, activation.playerId)) {
                    // Allow activating player to continue if possible
                    return MachineState.SolarFlares
                } else {
                    gameState.removeActivationForPlayer(activation.playerId)
                    gameState.activePlayerIds = gameState.activePlayerIds.filter(
                        (id) => id !== activation.playerId
                    )
                }

                if (gameState.activations && gameState.activations.length > 0) {
                    return MachineState.SolarFlares
                } else {
                    const turnPlayer = gameState.turnManager.currentTurn()?.playerId
                    if (turnPlayer) {
                        gameState.activePlayerIds = [turnPlayer]
                    }
                    return SolarFlaresStateHandler.continueSolarFlaresOrEnd(gameState, context)
                }
                break
            }
            case isPass(action): {
                gameState.removeActivationForPlayer(action.playerId)
                gameState.activePlayerIds = gameState.activePlayerIds.filter(
                    (id) => id !== action.playerId
                )

                if (gameState.activations && gameState.activations.length > 0) {
                    return MachineState.SolarFlares
                } else {
                    return SolarFlaresStateHandler.continueSolarFlaresOrEnd(gameState, context)
                }
                break
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    static continueSolarFlaresOrEnd(
        state: HydratedSolGameState,
        context: MachineContext
    ): MachineState {
        state.solarFlaresRemaining = state.solarFlaresRemaining! - 1
        state.solarFlareActivationsGroupId = undefined

        const turnPlayer = state.turnManager.currentTurn()?.playerId
        if (turnPlayer) {
            state.activePlayerIds = [turnPlayer]
        }

        if (state.solarFlaresRemaining! > 0) {
            const prng = new Prng(state.prng)
            const solarFlareAction: SolarFlare = {
                type: ActionType.SolarFlare,
                id: prng.randId(),
                gameId: context.gameState.gameId,
                source: ActionSource.System
            }
            context.addPendingAction(solarFlareAction)
            return MachineState.SolarFlares
        } else if (state.instability === 0) {
            return MachineState.EndOfGame
        } else {
            state.solarFlares = 0

            const currentPlayerId = state.turnManager.currentTurn()?.playerId
            assertExists(currentPlayerId, 'No current turn player found')

            state.activePlayerIds = [currentPlayerId]
            const currentPlayerState = state.getPlayerState(currentPlayerId)
            if (!currentPlayerState.hasCardChoice()) {
                const passAction: Pass = {
                    type: ActionType.Pass,
                    id: nanoid(),
                    gameId: context.gameState.gameId,
                    playerId: currentPlayerId,
                    source: ActionSource.System
                }
                context.addPendingAction(passAction)
            }
            return MachineState.ChoosingCard
        }
    }
}
