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
import { HydratedPass, Pass, PassReason, isPass } from '../actions/pass.js'
import { isProductionCompany } from '../components/company.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { buildDeliveryProblem } from '../operations/deliveryProblemBuilder.js'
import {
    describeProductionOperation,
    ProductionOperationStage
} from '../operations/productionOperationProgress.js'
import { solveDeliveryProblem } from '../operations/deliverySolver.js'
import { finishOperatingCompany } from './operationsFlow.js'

type ProductionOperationsAction = HydratedDeliverGood | HydratedExpand | HydratedPass

export class ProductionOperationsStateHandler
    implements MachineStateHandler<ProductionOperationsAction, HydratedIndonesiaGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is ProductionOperationsAction {
        return isDeliverGood(action) || isExpand(action) || isPass(action)
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
        if (HydratedPass.canPass(gameState, playerId)) {
            validActions.push(ActionType.Pass)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        this.solveAndStoreOperatingCompanyDeliveryPlan(context.gameState)
        this.queueSkipExpansionIfNeeded(context)
    }

    onAction(
        action: ProductionOperationsAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        const state = context.gameState
        switch (true) {
            case isDeliverGood(action): {
                if (HydratedDeliverGood.canDeliverGood(state, action.playerId)) {
                    return MachineState.ProductionOperations
                }

                if (HydratedExpand.canExpand(state, action.playerId)) {
                    return MachineState.ProductionOperations
                }

                return finishOperatingCompany(state)
            }
            case isExpand(action): {
                if (HydratedExpand.canExpand(state, action.playerId)) {
                    return MachineState.ProductionOperations
                }

                return finishOperatingCompany(state)
            }
            case isPass(action): {
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

        if (
            state.operatingCompanyDeliveryPlan?.operatingCompanyId === operatingCompanyId &&
            state.operatingCompanyProducedGoodsCount !== undefined
        ) {
            return
        }

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
        const producedGoodsCount = problem.zoneSupplies.reduce(
            (total, zoneSupply) => total + zoneSupply.supply,
            0
        )

        state.setOperatingCompanyDeliveryPlan(deliveryPlan)
        state.setOperatingCompanyProducedGoodsCount(producedGoodsCount)
    }

    private queueSkipExpansionIfNeeded(context: MachineContext<HydratedIndonesiaGameState>): void {
        const state = context.gameState
        const productionProgress = describeProductionOperation(state)
        if (!productionProgress) {
            return
        }
        if (productionProgress.stage === ProductionOperationStage.Delivery) {
            return
        }
        if (HydratedExpand.canExpand(state, productionProgress.ownerPlayerId)) {
            return
        }

        context.addSystemAction(Pass, {
            playerId: productionProgress.ownerPlayerId,
            reason: PassReason.SkipProductionExpansion
        })
    }
}
