import {
    type HydratedAction,
    type MachineStateHandler,
    ActionSource,
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

// Transition from CheckEffect(ActivateEffect) -> ??
// Transition from CheckEffect(Pass) -> ??

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

        console.log('Valid check effect actions', validActions)
        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: CheckEffectAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isPass(action): {
                return drawCardsOrEndTurn(gameState, context)
            }
            case isActivateEffect(action): {
                if (gameState.activeEffect === EffectType.Motivate) {
                    const station = gameState.effectTracking?.convertedStation
                    if (!station || !station.coords) {
                        throw Error('No converted station with coords found for Motivate effect')
                    }
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
                } else {
                    return drawCardsOrEndTurn(gameState, context)
                }
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
