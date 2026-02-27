import { assert, assertExists } from '@tabletop/common'
import { isProductionCompany } from '../components/company.js'
import { GOOD_REVENUE_BY_GOOD } from '../definition/operationsEconomy.js'
import { MachineState } from '../definition/states.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'

export enum ProductionOperationStage {
    Delivery = 'delivery',
    MandatoryExpansion = 'mandatory-expansion',
    OptionalExpansion = 'optional-expansion'
}

export type ProductionOperationProgress = {
    stage: ProductionOperationStage
    operatingCompanyId: string
    ownerPlayerId: string
    producedGoodsCount: number
    deliveryTarget: number
    shippedGoodsCount: number
    expansionCostPerArea: number
}

export function describeProductionOperation(
    state: HydratedIndonesiaGameState
): ProductionOperationProgress | null {
    if (state.machineState !== MachineState.ProductionOperations) {
        return null
    }

    const operatingCompanyId = state.operatingCompanyId
    if (!operatingCompanyId) {
        return null
    }

    const operatingCompany = state.companies.find((company) => company.id === operatingCompanyId)
    if (!isProductionCompany(operatingCompany)) {
        return null
    }

    const deliveryPlan = state.operatingCompanyDeliveryPlan
    if (!deliveryPlan || deliveryPlan.operatingCompanyId !== operatingCompanyId) {
        return null
    }

    const producedGoodsCount = state.operatingCompanyProducedGoodsCount
    assertExists(
        producedGoodsCount,
        'Operating company produced-goods count should be initialized in production operations'
    )

    const deliveryTarget = deliveryPlan.totalDelivered
    assert(
        deliveryTarget <= producedGoodsCount,
        `Delivery target ${deliveryTarget} should not exceed produced goods count ${producedGoodsCount}`
    )
    const shippedGoodsCount = state.operatingCompanyShippedGoodsCount ?? 0
    if (shippedGoodsCount < deliveryTarget) {
        return {
            stage: ProductionOperationStage.Delivery,
            operatingCompanyId,
            ownerPlayerId: operatingCompany.owner,
            producedGoodsCount,
            deliveryTarget,
            shippedGoodsCount,
            expansionCostPerArea: 0
        }
    }

    const soldAllProducedGoods = deliveryTarget >= producedGoodsCount
    return {
        stage: soldAllProducedGoods
            ? ProductionOperationStage.MandatoryExpansion
            : ProductionOperationStage.OptionalExpansion,
        operatingCompanyId,
        ownerPlayerId: operatingCompany.owner,
        producedGoodsCount,
        deliveryTarget,
        shippedGoodsCount,
        expansionCostPerArea: soldAllProducedGoods ? 0 : GOOD_REVENUE_BY_GOOD[operatingCompany.good]
    }
}

export function canAnyProductionExpansionBeApplied(
    state: HydratedIndonesiaGameState,
    playerId: string
): boolean {
    const progress = describeProductionOperation(state)
    if (!progress) {
        return false
    }
    if (progress.stage === ProductionOperationStage.Delivery) {
        return false
    }
    if (progress.ownerPlayerId !== playerId) {
        return false
    }
    if (!state.canCurrentOperationExpandForPlayer(playerId)) {
        return false
    }
    if (progress.expansionCostPerArea > 0) {
        const playerState = state.getPlayerState(playerId)
        if (playerState.cash < progress.expansionCostPerArea) {
            return false
        }
    }

    return state.canCompanyExpand(progress.operatingCompanyId)
}
