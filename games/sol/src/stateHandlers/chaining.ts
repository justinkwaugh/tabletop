import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedChain, isChain } from '../actions/chain.js'
import { drawCardsOrEndTurn } from './postActionHelper.js'

// Transition from Chaining(Chain) -> PREVIOUS STATE

export class ChainingStateHandler implements MachineStateHandler<HydratedChain> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedChain {
        if (!action.playerId) return false
        return isChain(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        return [ActionType.Chain]
    }

    enter(_context: MachineContext) {}

    onAction(action: HydratedChain, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isChain(action): {
                const effectTracking = gameState.getEffectTracking()
                const preEffectState = effectTracking.preEffectState

                if (!preEffectState || preEffectState === MachineState.CheckEffect) {
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
