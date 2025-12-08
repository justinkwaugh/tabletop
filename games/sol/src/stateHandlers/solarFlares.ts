import {
    type HydratedAction,
    type MachineStateHandler,
    ActionSource,
    MachineContext
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

// Transition from SolarFlares(SolarFlare) -> SolarFlares | ChoosingCard
// Transition from SolarFlares(Activate) -> SolarFlares | ChoosingCard
// Transition from SolarFlares(Pass) -> SolarFlares | ChoosingCard

type SolarFlaresActions = HydratedPass | HydratedSolarFlare | HydratedActivate

export class SolarFlaresStateHandler implements MachineStateHandler<SolarFlaresActions> {
    isValidAction(action: HydratedAction, context: MachineContext): action is SolarFlaresActions {
        return isSolarFlare(action) || isActivate(action) || isPass(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        return [ActionType.Pass, ActionType.Activate]
    }

    enter(_context: MachineContext) {}

    onAction(action: SolarFlaresActions, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isSolarFlare(action): {
                const activatingPlayerIds = gameState.players
                    .filter((ps) => gameState.board.hasStationInRing(ps.playerId, Ring.Outer))
                    .map((ps) => ps.playerId)

                // Let current player go first for efficiency
                const currentPlayerId = gameState.turnManager.currentTurn()?.playerId
                if (!currentPlayerId) {
                    throw Error('No current turn player found')
                }

                if (activatingPlayerIds.includes(currentPlayerId)) {
                    activatingPlayerIds.splice(activatingPlayerIds.indexOf(currentPlayerId), 1)
                    activatingPlayerIds.unshift(currentPlayerId)
                }

                const activations = activatingPlayerIds.map((playerId) => {
                    return {
                        playerId: playerId,
                        activatedIds: []
                    } satisfies Activation
                })

                if (activations.length > 0) {
                    gameState.activation = activations.shift()
                    gameState.solarFlareActivations = activations
                    gameState.activePlayerIds = [gameState.activation!.playerId]
                    return MachineState.SolarFlares
                } else {
                    return SolarFlaresStateHandler.continueSolarFlaresOrEnd(gameState, context)
                }
                break
            }
            case isActivate(action): {
                const activation = gameState.activation
                if (!activation) {
                    throw Error('Cannot find activation')
                }

                if (HydratedActivate.canActivate(gameState, activation.playerId)) {
                    // Allow activating player to continue if possible
                    activation.currentStationId = undefined
                    activation.currentStationCoords = undefined
                    gameState.activePlayerIds = [activation.playerId]
                    return MachineState.SolarFlares
                } else if (
                    gameState.solarFlareActivations &&
                    gameState.solarFlareActivations.length > 0
                ) {
                    gameState.activation = gameState.solarFlareActivations.shift()
                    gameState.activePlayerIds = [gameState.activation!.playerId]
                    return MachineState.SolarFlares
                } else {
                    return SolarFlaresStateHandler.continueSolarFlaresOrEnd(gameState, context)
                }
                break
            }
            case isPass(action): {
                if (gameState.solarFlareActivations && gameState.solarFlareActivations.length > 0) {
                    gameState.activation = gameState.solarFlareActivations.shift()
                    gameState.activePlayerIds = [gameState.activation!.playerId]
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
        if (state.solarFlaresRemaining! > 0) {
            const solarFlareAction: SolarFlare = {
                type: ActionType.SolarFlare,
                id: nanoid(),
                gameId: context.gameState.gameId,
                source: ActionSource.System
            }
            context.addPendingAction(solarFlareAction)
            return MachineState.SolarFlares
        } else {
            state.solarFlares = 0
            state.activation = undefined
            state.solarFlareActivations = undefined

            const currentPlayerId = state.turnManager.currentTurn()?.playerId
            if (!currentPlayerId) {
                throw Error('No current turn player found')
            }
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
