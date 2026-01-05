import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedSolGameState } from '../model/gameState.js'
import { HydratedMetamorphosize, isMetamorphosize } from '../actions/metamorphosize.js'
import { ActivatingStateHandler } from './activating.js'

// Transition from Metamorphosizing(Metamorphosize) -> DrawingCards | StartOfTurn

export class MetamorphosizingStateHandler implements MachineStateHandler<HydratedMetamorphosize> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext
    ): action is HydratedMetamorphosize {
        if (!action.playerId) return false
        return isMetamorphosize(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        return [ActionType.Metamorphosize]
    }

    enter(_context: MachineContext) {}

    onAction(action: HydratedMetamorphosize, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedSolGameState

        switch (true) {
            case isMetamorphosize(action): {
                const activation = gameState.getActivationForPlayer(action.playerId)
                if (!activation) {
                    throw Error('No activation in metamorphosizing state')
                }
                return ActivatingStateHandler.continueActivatingOrEnd(
                    gameState,
                    context,
                    activation
                )
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
