import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedExpand, isExpand } from '../actions/expand.js'
import { HydratedPass, isPass, Pass, PassReason } from '../actions/pass.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { finishOperatingCompany } from './operationsFlow.js'

type ShippingOperationsAction = HydratedExpand | HydratedPass

export class ShippingOperationsStateHandler
    implements MachineStateHandler<ShippingOperationsAction, HydratedIndonesiaGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is ShippingOperationsAction {
        return isExpand(action) || isPass(action)
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
        if (HydratedPass.canPass(gameState, playerId)) {
            validActions.push(ActionType.Pass)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const state = context.gameState
        const operatingCompanyId = state.operatingCompanyId
        if (!operatingCompanyId) {
            return
        }

        const operatingCompany = state.companies.find((company) => company.id === operatingCompanyId)
        if (!operatingCompany) {
            return
        }

        if (
            !HydratedExpand.canExpand(state, operatingCompany.owner) &&
            !this.hasPendingNoValidOperationPass(context, operatingCompany.owner)
        ) {
            context.addSystemAction(Pass, {
                playerId: operatingCompany.owner,
                reason: PassReason.NoValidOperation
            })
        }
    }

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

                return finishOperatingCompany(state, context)
            }
            case isPass(action): {
                return finishOperatingCompany(state, context)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private hasPendingNoValidOperationPass(
        context: MachineContext<HydratedIndonesiaGameState>,
        playerId: string
    ): boolean {
        return context.getPendingActions().some(
            (pendingAction) =>
                isPass(pendingAction) &&
                pendingAction.playerId === playerId &&
                pendingAction.reason === PassReason.NoValidOperation
        )
    }
}
