import {
    assert,
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedDeliverGood, isDeliverGood } from '../actions/deliverGood.js'
import { HydratedExpand, isExpand } from '../actions/expand.js'
import { isProductionCompany } from '../components/company.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { buildDeliveryProblem } from '../operations/deliveryProblemBuilder.js'
import { solveDeliveryProblem } from '../operations/deliverySolver.js'
import { finishOperatingCompany } from './operationsFlow.js'

type ProductionOperationsAction = HydratedDeliverGood | HydratedExpand

export class ProductionOperationsStateHandler
    implements MachineStateHandler<ProductionOperationsAction, HydratedIndonesiaGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is ProductionOperationsAction {
        return isDeliverGood(action) || isExpand(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState
        const validActions: ActionType[] = []

        if (HydratedDeliverGood.canDeliverGood(gameState, playerId)) {
            validActions.push(ActionType.DeliverGood)
        }
        if (HydratedExpand.canExpand(gameState, playerId)) {
            validActions.push(ActionType.Expand)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        this.solveAndStoreOperatingCompanyDeliveryPlan(context.gameState)
    }

    onAction(
        action: ProductionOperationsAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        const state = context.gameState
        switch (true) {
            case isDeliverGood(action):
            case isExpand(action): {
                return finishOperatingCompany(state)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private solveAndStoreOperatingCompanyDeliveryPlan(state: HydratedIndonesiaGameState): void {
        const operatingCompanyId = state.operatingCompanyId
        assertExists(
            operatingCompanyId,
            'Operating company id should be set before entering ProductionOperations'
        )

        const operatingCompany = state.companies.find((company) => company.id === operatingCompanyId)
        assertExists(
            operatingCompany,
            `Operating company ${operatingCompanyId} should exist before entering ProductionOperations`
        )
        assert(
            isProductionCompany(operatingCompany),
            `Operating company ${operatingCompanyId} should be a production company in ProductionOperations`
        )

        const problem = buildDeliveryProblem(state, operatingCompanyId)
        const deliveryPlan = solveDeliveryProblem(problem)
        state.setOperatingCompanyDeliveryPlan(deliveryPlan)
    }
}
