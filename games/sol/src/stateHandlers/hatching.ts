import {
    type HydratedAction,
    type MachineStateHandler,
    assert,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedHatch, isHatch } from '../actions/hatch.js'
import { drawCardsOrEndTurn } from './postActionHelper.js'

// Transition from Hatching(Hatch) -> PREVIOUS STATE

export class HatchingStateHandler implements MachineStateHandler<HydratedHatch> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedHatch {
        if (!action.playerId) return false
        return isHatch(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        return [ActionType.Hatch]
    }

    enter(_context: MachineContext) {}

    onAction(action: HydratedHatch, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isHatch(action): {
                const effectTracking = gameState.getEffectTracking()
                const preHatchState = effectTracking.preEffectState
                assertExists(preHatchState, 'No pre-hatch state recorded')

                gameState.activeEffect = undefined
                if (preHatchState === MachineState.CheckEffect) {
                    return drawCardsOrEndTurn(gameState, context)
                }

                return preHatchState
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
