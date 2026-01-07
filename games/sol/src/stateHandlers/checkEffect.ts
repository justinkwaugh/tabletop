import {
    type HydratedAction,
    type MachineStateHandler,
    ActionSource,
    assert,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { drawCardsOrEndTurn } from './postActionHelper.js'
import { HydratedActivateEffect, isActivateEffect } from '../actions/activateEffect.js'
import { EffectType } from '../components/effects.js'
import { Activate } from '../actions/activate.js'
import { nanoid } from 'nanoid'
import { ActivatingStateHandler } from './activating.js'
import { Ring } from '../utils/solGraph.js'

// Transition from CheckEffect(ActivateEffect) -> Lots of places
// Transition from CheckEffect(Pass) -> Lots of places

type CheckEffectAction = HydratedPass | HydratedActivateEffect

export class CheckEffectStateHandler implements MachineStateHandler<CheckEffectAction> {
    isValidAction(action: HydratedAction, context: MachineContext): action is CheckEffectAction {
        if (!action.playerId) return false
        const gameState = context.gameState as HydratedSolGameState

        return isPass(action) || isActivateEffect(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState

        const validActions = [ActionType.Pass]

        if (HydratedActivateEffect.canActivateHeldEffect(gameState, playerId)) {
            validActions.push(ActionType.ActivateEffect)
        }

        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: CheckEffectAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isPass(action): {
                const playerState = gameState.getPlayerState(action.playerId)
                if (playerState.card) {
                    const effect = gameState.effects[playerState.card.suit].type
                    if (effect === EffectType.Augment) {
                        return ActivatingStateHandler.handleActivation(
                            gameState,
                            context,
                            action.playerId
                        )
                    } else if (effect === EffectType.Metamorphosis) {
                        const activation = gameState.getActivationForPlayer(action.playerId)
                        assertExists(activation, 'No activation found for Metamorphosis effect')

                        return ActivatingStateHandler.continueActivatingOrEnd(
                            gameState,
                            context,
                            activation
                        )
                    } else if (effect === EffectType.Squeeze) {
                        return ActivatingStateHandler.handleActivation(
                            gameState,
                            context,
                            action.playerId
                        )
                    } else if (effect === EffectType.Pillar) {
                        return MachineState.DrawingCards
                    }
                }
                return drawCardsOrEndTurn(gameState, context)
            }
            case isActivateEffect(action): {
                if (gameState.activeEffect === EffectType.Motivate) {
                    const station = gameState.effectTracking?.convertedStation
                    assertExists(
                        station,
                        'No converted station found for Motivate effect'
                    )
                    assertExists(station.coords, 'No coords found for Motivate effect station')
                    const activateAction: Activate = {
                        type: ActionType.Activate,
                        id: nanoid(),
                        gameId: context.gameState.gameId,
                        playerId: action.playerId,
                        source: ActionSource.System,
                        coords: station.coords,
                        stationId: station.id
                    }
                    context.addPendingAction(activateAction)
                    return MachineState.Activating
                } else if (gameState.activeEffect === EffectType.Augment) {
                    return ActivatingStateHandler.handleActivation(
                        gameState,
                        context,
                        action.playerId
                    )
                } else if (gameState.activeEffect === EffectType.Cascade) {
                    return MachineState.Converting
                } else if (gameState.activeEffect === EffectType.Metamorphosis) {
                    return MachineState.Metamorphosizing
                } else if (gameState.activeEffect === EffectType.Squeeze) {
                    const station = gameState.getActivatingStation(action.playerId)
                    if (station.coords!.row < Ring.Inner) {
                        return MachineState.DrawingCards
                    } else {
                        return ActivatingStateHandler.handleActivation(
                            gameState,
                            context,
                            action.playerId
                        )
                    }
                } else if (gameState.activeEffect === EffectType.Chain) {
                    return MachineState.Chaining
                } else if (gameState.activeEffect === EffectType.Pillar) {
                    return MachineState.DrawingCards
                } else if (gameState.activeEffect === EffectType.Hatch) {
                    return MachineState.Hatching
                } else if (action.effect === EffectType.Procreate) {
                    return drawCardsOrEndTurn(gameState, context)
                } else if (gameState.activeEffect === EffectType.Accelerate) {
                    return MachineState.Accelerating
                } else if (gameState.activeEffect === EffectType.Tribute) {
                    return MachineState.Tributing
                }
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
