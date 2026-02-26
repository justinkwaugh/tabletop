import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedExpand, isExpand } from '../actions/expand.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { finishOperatingCompany } from './operationsFlow.js'

type ShippingOperationsAction = HydratedExpand

export class ShippingOperationsStateHandler
    implements MachineStateHandler<ShippingOperationsAction, HydratedIndonesiaGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is ShippingOperationsAction {
        return isExpand(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState
        const validActions: ActionType[] = []

        if (HydratedExpand.canExpand(gameState, playerId)) {
            validActions.push(ActionType.Expand)
        }

        return validActions
    }

    enter(_context: MachineContext<HydratedIndonesiaGameState>) {}

    onAction(
        action: ShippingOperationsAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        const state = context.gameState
        switch (true) {
            case isExpand(action): {
                if (HydratedExpand.canExpand(state, action.playerId)) {
                    return MachineState.ShippingOperations
                }

                return finishOperatingCompany(state)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
