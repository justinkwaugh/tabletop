import {
    assert,
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { DeliverGood, HydratedDeliverGood, isDeliverGood } from '../actions/deliverGood.js'
import { HydratedExpand, isExpand } from '../actions/expand.js'
import { HydratedPass, isPass, Pass, PassReason } from '../actions/pass.js'
import {
    HydratedRemoveCompanyDeed,
    isRemoveCompanyDeed
} from '../actions/removeCompanyDeed.js'
import { isProductionCompany } from '../components/company.js'
import {
    GOOD_REVENUE_BY_GOOD,
    SHIPPING_FEE_PER_SHIP_USE
} from '../definition/operationsEconomy.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { buildDeliveryProblem } from '../operations/deliveryProblemBuilder.js'
import { buildResidualDeliveryProblem } from '../operations/deliveryCandidateContext.js'
import type { DeliveryPlan, ShipUse, ShippingPayment } from '../operations/deliveryPlan.js'
import {
    describeProductionOperation,
    ProductionOperationStage
} from '../operations/productionOperationProgress.js'
import { solveDeliveryProblem } from '../operations/deliverySolver.js'
import { isIndonesiaNodeId } from '../utils/indonesiaNodes.js'
import { finishOperatingCompany } from './operationsFlow.js'

type ProductionOperationsAction =
    | HydratedDeliverGood
    | HydratedExpand
    | HydratedPass
    | HydratedRemoveCompanyDeed

export class ProductionOperationsStateHandler
    implements MachineStateHandler<ProductionOperationsAction, HydratedIndonesiaGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is ProductionOperationsAction {
        return (
            isDeliverGood(action) ||
            isExpand(action) ||
            isPass(action) ||
            isRemoveCompanyDeed(action)
        )
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
        this.queueRequiredDeliveryIfNeeded(context)
        this.queueNoValidOperationPassIfNeeded(context)
    }

    onAction(
        action: ProductionOperationsAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        const state = context.gameState
        switch (true) {
            case isDeliverGood(action): {
                this.solveAndStoreOperatingCompanyDeliveryPlan(state, { force: true })
                this.queueRequiredDeliveryIfNeeded(context)

                const actingPlayerId = this.operatingCompanyOwnerId(state)
                assertExists(
                    actingPlayerId,
                    'Operating company owner should exist after a delivery in ProductionOperations'
                )

                if (HydratedDeliverGood.requiredSystemCandidate(state)) {
                    return MachineState.ProductionOperations
                }

                if (HydratedDeliverGood.canDeliverGood(state, actingPlayerId)) {
                    return MachineState.ProductionOperations
                }

                if (HydratedExpand.canExpand(state, actingPlayerId)) {
                    return MachineState.ProductionOperations
                }

                return finishOperatingCompany(state, context)
            }
            case isExpand(action): {
                if (HydratedExpand.canExpand(state, action.playerId)) {
                    return MachineState.ProductionOperations
                }

                return finishOperatingCompany(state, context)
            }
            case isPass(action): {
                return finishOperatingCompany(state, context)
            }
            case isRemoveCompanyDeed(action): {
                return MachineState.ProductionOperations
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private solveAndStoreOperatingCompanyDeliveryPlan(
        state: HydratedIndonesiaGameState,
        options?: { force?: boolean }
    ): void {
        const operatingCompanyId = state.operatingCompanyId
        assertExists(
            operatingCompanyId,
            'Operating company id should be set before entering ProductionOperations'
        )

        if (
            !options?.force &&
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

        const existingPlan = state.operatingCompanyDeliveryPlan
        const shippedGoodsCount = state.operatingCompanyShippedGoodsCount ?? 0

        if (options?.force && existingPlan?.operatingCompanyId === operatingCompanyId) {
            const residual = buildResidualDeliveryProblem(state, operatingCompanyId)
            const nextPlan = solveDeliveryProblem(residual.problem)
            state.setOperatingCompanyDeliveryPlan(
                this.mergeProgressIntoDeliveryPlan(state, existingPlan, nextPlan, shippedGoodsCount)
            )
            return
        }

        const problem = buildDeliveryProblem(state, operatingCompanyId)
        const nextPlan = solveDeliveryProblem(problem)
        const producedGoodsCount = problem.zoneSupplies.reduce(
            (total, zoneSupply) => total + zoneSupply.supply,
            0
        )

        state.setOperatingCompanyDeliveryPlan(nextPlan)
        state.setOperatingCompanyProducedGoodsCount(producedGoodsCount)
    }

    private queueRequiredDeliveryIfNeeded(
        context: MachineContext<HydratedIndonesiaGameState>
    ): void {
        const ownerPlayerId = this.operatingCompanyOwnerId(context.gameState)
        if (!ownerPlayerId) {
            return
        }

        const requiredCandidate = HydratedDeliverGood.requiredSystemCandidate(context.gameState)
        if (!requiredCandidate) {
            return
        }

        if (this.hasPendingRequiredDelivery(context, requiredCandidate, ownerPlayerId)) {
            return
        }

        context.addSystemAction(DeliverGood, {
            playerId: ownerPlayerId,
            cultivatedAreaId: requiredCandidate.cultivatedAreaId,
            shippingCompanyId: requiredCandidate.shippingCompanyId,
            seaAreaIds: requiredCandidate.seaAreaIds,
            cityId: requiredCandidate.cityId
        })
    }

    private hasPendingRequiredDelivery(
        context: MachineContext<HydratedIndonesiaGameState>,
        requiredCandidate: ReturnType<typeof HydratedDeliverGood.requiredSystemCandidate>,
        ownerPlayerId: string
    ): boolean {
        if (!requiredCandidate) {
            return false
        }

        return context.getPendingActions().some(
            (pendingAction) =>
                isDeliverGood(pendingAction) &&
                pendingAction.playerId === ownerPlayerId &&
                pendingAction.cultivatedAreaId === requiredCandidate.cultivatedAreaId &&
                pendingAction.shippingCompanyId === requiredCandidate.shippingCompanyId &&
                pendingAction.cityId === requiredCandidate.cityId &&
                pendingAction.seaAreaIds.length === requiredCandidate.seaAreaIds.length &&
                pendingAction.seaAreaIds.every(
                    (seaAreaId, index) => seaAreaId === requiredCandidate.seaAreaIds[index]
                )
        )
    }

    private queueNoValidOperationPassIfNeeded(
        context: MachineContext<HydratedIndonesiaGameState>
    ): void {
        const ownerPlayerId = this.operatingCompanyOwnerId(context.gameState)
        if (!ownerPlayerId) {
            return
        }

        if (
            HydratedDeliverGood.canDeliverGood(context.gameState, ownerPlayerId) ||
            HydratedExpand.canExpand(context.gameState, ownerPlayerId) ||
            this.hasPendingNoValidOperationPass(context, ownerPlayerId)
        ) {
            return
        }

        context.addSystemAction(Pass, {
            playerId: ownerPlayerId,
            reason: PassReason.NoValidOperation
        })
    }

    private hasPendingNoValidOperationPass(
        context: MachineContext<HydratedIndonesiaGameState>,
        ownerPlayerId: string
    ): boolean {
        return context.getPendingActions().some(
            (pendingAction) =>
                isPass(pendingAction) &&
                pendingAction.playerId === ownerPlayerId &&
                pendingAction.reason === PassReason.NoValidOperation
        )
    }

    private operatingCompanyOwnerId(state: HydratedIndonesiaGameState): string | undefined {
        const operatingCompanyId = state.operatingCompanyId
        if (!operatingCompanyId) {
            return undefined
        }

        return state.companies.find((company) => company.id === operatingCompanyId)?.owner
    }

    private mergeProgressIntoDeliveryPlan(
        state: HydratedIndonesiaGameState,
        existingPlan: DeliveryPlan,
        residualPlan: DeliveryPlan,
        shippedGoodsCount: number
    ): DeliveryPlan {
        const actualRevenue = shippedGoodsCount * GOOD_REVENUE_BY_GOOD[existingPlan.good]
        const actualShipUses = this.actualShipUsesSoFar(state)
        const actualShippingCost = actualShipUses.reduce((sum, shipUse) => sum + shipUse.uses, 0) *
            SHIPPING_FEE_PER_SHIP_USE
        const actualShippingPayments = this.actualShippingPaymentsSoFar(actualShipUses)

        const shipUses = this.mergeShipUses(actualShipUses, residualPlan.shipUses)
        const shippingPayments = this.mergeShippingPayments(
            actualShippingPayments,
            residualPlan.shippingPayments
        )
        const totalDelivered = shippedGoodsCount + residualPlan.totalDelivered
        const revenue = actualRevenue + residualPlan.revenue
        const shippingCost = actualShippingCost + residualPlan.shippingCost

        return {
            ...residualPlan,
            operatingCompanyId: existingPlan.operatingCompanyId,
            good: existingPlan.good,
            shipUses,
            shippingPayments,
            totalDelivered,
            revenue,
            shippingCost,
            netIncome: revenue - shippingCost,
            tieBreakResult: {
                ...residualPlan.tieBreakResult,
                deliveredGoods: totalDelivered,
                shippingCost
            }
        }
    }

    private actualShipUsesSoFar(state: HydratedIndonesiaGameState): ShipUse[] {
        const shipUseCounts = state.operatingCompanyShipUseCounts ?? {}
        return Object.entries(shipUseCounts)
            .map(([key, uses]) => {
                const separatorIndex = key.indexOf('|')
                if (separatorIndex <= 0 || separatorIndex >= key.length - 1) {
                    return null
                }

                const seaAreaId = key.slice(separatorIndex + 1)
                if (!isIndonesiaNodeId(seaAreaId)) {
                    return null
                }

                return {
                    shippingCompanyId: key.slice(0, separatorIndex),
                    seaAreaId,
                    uses
                } satisfies ShipUse
            })
            .filter((shipUse): shipUse is ShipUse => shipUse !== null)
            .sort((left, right) =>
                `${left.shippingCompanyId}|${left.seaAreaId}`.localeCompare(
                    `${right.shippingCompanyId}|${right.seaAreaId}`
                )
            )
    }

    private actualShippingPaymentsSoFar(shipUses: readonly ShipUse[]): ShippingPayment[] {
        const amountByShippingCompanyId = new Map<string, number>()
        for (const shipUse of shipUses) {
            amountByShippingCompanyId.set(
                shipUse.shippingCompanyId,
                (amountByShippingCompanyId.get(shipUse.shippingCompanyId) ?? 0) +
                    shipUse.uses * SHIPPING_FEE_PER_SHIP_USE
            )
        }

        return [...amountByShippingCompanyId.entries()]
            .map(([shippingCompanyId, amount]) => ({
                shippingCompanyId,
                amount
            }))
            .sort((left, right) => left.shippingCompanyId.localeCompare(right.shippingCompanyId))
    }

    private mergeShipUses(actualShipUses: readonly ShipUse[], residualShipUses: readonly ShipUse[]): ShipUse[] {
        const usesByKey = new Map<string, ShipUse>()
        for (const shipUse of [...actualShipUses, ...residualShipUses]) {
            const key = `${shipUse.shippingCompanyId}|${shipUse.seaAreaId}`
            const current = usesByKey.get(key)
            if (current) {
                current.uses += shipUse.uses
                continue
            }
            usesByKey.set(key, { ...shipUse })
        }

        return [...usesByKey.values()].sort((left, right) =>
            `${left.shippingCompanyId}|${left.seaAreaId}`.localeCompare(
                `${right.shippingCompanyId}|${right.seaAreaId}`
            )
        )
    }

    private mergeShippingPayments(
        actualPayments: readonly ShippingPayment[],
        residualPayments: readonly ShippingPayment[]
    ): ShippingPayment[] {
        const amountByShippingCompanyId = new Map<string, number>()
        for (const payment of [...actualPayments, ...residualPayments]) {
            amountByShippingCompanyId.set(
                payment.shippingCompanyId,
                (amountByShippingCompanyId.get(payment.shippingCompanyId) ?? 0) + payment.amount
            )
        }

        return [...amountByShippingCompanyId.entries()]
            .map(([shippingCompanyId, amount]) => ({
                shippingCompanyId,
                amount
            }))
            .sort((left, right) => left.shippingCompanyId.localeCompare(right.shippingCompanyId))
    }
}
