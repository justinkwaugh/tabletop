import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { drawCardsOrEndTurn } from './postActionHelper.js'
import { HydratedConvert, isConvert } from '../actions/convert.js'
import { HydratedActivateEffect, isActivateEffect } from '../actions/activateEffect.js'
import { EffectType } from '../components/effects.js'
import { HydratedInvade, isInvade } from '../actions/invade.js'

// Transition from Converting(Pass) -> DrawingCards | StartOfTurn
// Transition from Converting(Convert) -> Converting | DrawingCards | StartOfTurn
// Transition from Converting(ActivateEffect) -> Converting

type ConvertingAction = HydratedConvert | HydratedPass | HydratedActivateEffect

export class ConvertingStateHandler implements MachineStateHandler<ConvertingAction> {
    isValidAction(action: HydratedAction, context: MachineContext): action is ConvertingAction {
        if (!action.playerId) return false
        const gameState = context.gameState as HydratedSolGameState

        return isPass(action) || isConvert(action) || isActivateEffect(action) || isInvade(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedSolGameState

        const validActions = [ActionType.Pass]

        if (HydratedConvert.canConvert(gameState, playerId)) {
            validActions.push(ActionType.Convert)
        }

        if (HydratedActivateEffect.canActivateHeldEffect(gameState, playerId)) {
            validActions.push(ActionType.ActivateEffect)
        }

        if (
            gameState.activeEffect === EffectType.Invade &&
            HydratedInvade.canInvade(gameState, playerId)
        ) {
            validActions.push(ActionType.Invade)
        }

        console.log('Valid converting actions', validActions)
        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: ConvertingAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isInvade(action): {
                return drawCardsOrEndTurn(gameState, context)
            }
            case isConvert(action): {
                // Check for motivate
                if (
                    HydratedActivateEffect.canActivateEffect(
                        gameState,
                        action.playerId,
                        EffectType.Motivate
                    )
                ) {
                    return MachineState.CheckEffect
                }

                if (
                    HydratedActivateEffect.canActivateEffect(
                        gameState,
                        action.playerId,
                        EffectType.Cascade
                    )
                ) {
                    return MachineState.CheckEffect
                }

                return drawCardsOrEndTurn(gameState, context)
            }
            case isActivateEffect(action): {
                return MachineState.Converting
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
