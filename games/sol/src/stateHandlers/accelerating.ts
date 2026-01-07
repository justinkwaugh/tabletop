import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedAccelerate, isAccelerate } from '../actions/accelerate.js'
import { drawCardsOrEndTurn } from './postActionHelper.js'

// Transition from Accelerating(Accelerate) -> PREVIOUS STATE

export class AcceleratingStateHandler implements MachineStateHandler<HydratedAccelerate> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedAccelerate {
        if (!action.playerId) return false
        return isAccelerate(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        return [ActionType.Accelerate]
    }

    enter(_context: MachineContext) {}

    onAction(action: HydratedAccelerate, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isAccelerate(action): {
                const effectTracking = gameState.getEffectTracking()
                const preEffectState = effectTracking.preEffectState
                if (!preEffectState) {
                    throw Error('No pre-accelerate state recorded')
                }
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
