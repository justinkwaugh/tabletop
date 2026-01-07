import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedTribute, isTribute } from '../actions/tribute.js'
import { drawCardsOrEndTurn } from './postActionHelper.js'

// Transition from Tributing(Tribute) -> PREVIOUS STATE

export class TributingStateHandler implements MachineStateHandler<HydratedTribute> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedTribute {
        if (!action.playerId) return false
        return isTribute(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        return [ActionType.Tribute]
    }

    enter(_context: MachineContext) {}

    onAction(action: HydratedTribute, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isTribute(action): {
                const effectTracking = gameState.getEffectTracking()
                const preEffectState = effectTracking.preEffectState
                if (!preEffectState) {
                    throw Error('No pre-tribute state recorded')
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
