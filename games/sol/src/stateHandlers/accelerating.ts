import { type HydratedAction, type MachineStateHandler, assert, assertExists, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedAccelerate, isAccelerate } from '../actions/accelerate.js'
import { drawCardsOrEndTurn } from './postActionHelper.js'

// Transition from Accelerating(Accelerate) -> PREVIOUS STATE

export class AcceleratingStateHandler implements MachineStateHandler<HydratedAccelerate, HydratedSolGameState> {
    isValidAction(action: HydratedAction, context: MachineContext<HydratedSolGameState>): action is HydratedAccelerate {
        if (!action.playerId) return false
        return isAccelerate(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedSolGameState>): ActionType[] {
        return [ActionType.Accelerate]
    }

    enter(_context: MachineContext<HydratedSolGameState>) {}

    onAction(action: HydratedAccelerate, context: MachineContext<HydratedSolGameState>): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isAccelerate(action): {
                const effectTracking = gameState.getEffectTracking()
                const preEffectState = effectTracking.preEffectState
                assertExists(preEffectState, 'No pre-accelerate state recorded')

                gameState.activeEffect = undefined

                if (preEffectState === MachineState.CheckEffect) {
                    return drawCardsOrEndTurn(gameState, context)
                }
                return preEffectState
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
