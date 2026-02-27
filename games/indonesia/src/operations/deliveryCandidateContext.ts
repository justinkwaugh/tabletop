import { assert } from '@tabletop/common'
import { isProductionCompany } from '../components/company.js'
import { MachineState } from '../definition/states.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import {
    isIndonesiaNodeId,
    type IndonesiaNodeId
} from '../utils/indonesiaNodes.js'
import { buildDeliveryProblem } from './deliveryProblemBuilder.js'
import type { DeliveryProblem } from './deliveryPlan.js'
import { solveDeliveryProblem } from './deliverySolver.js'
import type {
    AtomicDeliveryCandidate,
    DeliveryOperationContext
} from './deliveryCandidateTypes.js'

function buildResidualDeliveryProblem(
    state: HydratedIndonesiaGameState,
    operatingCompanyId: string
): { problem: DeliveryProblem; deliveredCultivatedAreaIdSet: Set<IndonesiaNodeId> } {
    const baseProblem = buildDeliveryProblem(state, operatingCompanyId)
    const deliveredCultivatedAreaIds = state.operatingCompanyDeliveredCultivatedAreaIds ?? []
    const deliveredCultivatedAreaIdSet = new Set<IndonesiaNodeId>()
    for (const cultivatedAreaId of deliveredCultivatedAreaIds) {
        assert(
            isIndonesiaNodeId(cultivatedAreaId),
            `Delivered cultivated area id ${cultivatedAreaId} should be a valid node id`
        )
        deliveredCultivatedAreaIdSet.add(cultivatedAreaId)
    }

    const zoneIdByCultivatedAreaId = new Map<IndonesiaNodeId, string>()
    for (const zoneSupply of baseProblem.zoneSupplies) {
        for (const cultivatedAreaId of zoneSupply.areaIds) {
            const existingZoneId = zoneIdByCultivatedAreaId.get(cultivatedAreaId)
            assert(
                existingZoneId === undefined,
                `Cultivated area ${cultivatedAreaId} should only belong to one production zone (found ${existingZoneId} and ${zoneSupply.zoneId})`
            )
            zoneIdByCultivatedAreaId.set(cultivatedAreaId, zoneSupply.zoneId)
        }
    }
    for (const deliveredCultivatedAreaId of deliveredCultivatedAreaIdSet) {
        assert(
            zoneIdByCultivatedAreaId.has(deliveredCultivatedAreaId),
            `Delivered cultivated area ${deliveredCultivatedAreaId} should belong to an operating-company production zone`
        )
    }

    const zoneSupplies = baseProblem.zoneSupplies
        .map((zoneSupply) => {
            const deliveredFromZone = zoneSupply.areaIds.reduce((count, areaId) => {
                if (!deliveredCultivatedAreaIdSet.has(areaId)) {
                    return count
                }
                return count + 1
            }, 0)
            assert(
                deliveredFromZone <= zoneSupply.supply,
                `Delivered count ${deliveredFromZone} should not exceed zone supply ${zoneSupply.supply} for ${zoneSupply.zoneId}`
            )

            return {
                ...zoneSupply,
                supply: zoneSupply.supply - deliveredFromZone
            }
        })
        .filter((zoneSupply) => zoneSupply.supply > 0)

    const shippingCompanyNetworks = baseProblem.shippingCompanyNetworks
        .map((shippingNetwork) => {
            const seaAreaCapacities = shippingNetwork.seaAreaCapacities
                .map((seaAreaCapacity) => {
                    const usedCapacity = state.operatingCompanyShipUseCount(
                        shippingNetwork.shippingCompanyId,
                        seaAreaCapacity.seaAreaId
                    )
                    assert(
                        usedCapacity <= seaAreaCapacity.capacity,
                        `Used ship capacity ${usedCapacity} should not exceed available ${seaAreaCapacity.capacity} for ${shippingNetwork.shippingCompanyId} in ${seaAreaCapacity.seaAreaId}`
                    )

                    return {
                        ...seaAreaCapacity,
                        capacity: seaAreaCapacity.capacity - usedCapacity
                    }
                })
                .filter((seaAreaCapacity) => seaAreaCapacity.capacity > 0)

            const seaAreaIdSet = new Set<IndonesiaNodeId>(
                seaAreaCapacities.map((seaAreaCapacity) => seaAreaCapacity.seaAreaId)
            )
            const seaLanes = shippingNetwork.seaLanes.filter(
                (seaLane) =>
                    seaAreaIdSet.has(seaLane.fromSeaAreaId) &&
                    seaAreaIdSet.has(seaLane.toSeaAreaId)
            )

            return {
                ...shippingNetwork,
                seaLanes,
                seaAreaCapacities
            }
        })
        .filter((shippingNetwork) => shippingNetwork.seaAreaCapacities.length > 0)

    return {
        problem: {
            ...baseProblem,
            zoneSupplies,
            shippingCompanyNetworks
        },
        deliveredCultivatedAreaIdSet
    }
}

export function buildDeliveryOperationContext(
    state: HydratedIndonesiaGameState,
    playerId: string
): DeliveryOperationContext | null {
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
    if (operatingCompany.owner !== playerId) {
        return null
    }

    const deliveryPlan = state.operatingCompanyDeliveryPlan
    if (!deliveryPlan || deliveryPlan.operatingCompanyId !== operatingCompanyId) {
        return null
    }

    const shippedSoFar = state.operatingCompanyShippedGoodsCount ?? 0
    if (shippedSoFar >= deliveryPlan.totalDelivered) {
        return null
    }

    const residual = buildResidualDeliveryProblem(state, operatingCompanyId)
    const zoneById = new Map(residual.problem.zoneSupplies.map((zoneSupply) => [zoneSupply.zoneId, zoneSupply]))
    const zoneIdByCultivatedAreaId = new Map<IndonesiaNodeId, string>()
    for (const zoneSupply of residual.problem.zoneSupplies) {
        for (const cultivatedAreaId of zoneSupply.areaIds) {
            zoneIdByCultivatedAreaId.set(cultivatedAreaId, zoneSupply.zoneId)
        }
    }
    const cityDemandById = new Map(
        residual.problem.cityDemands.map((cityDemand) => [cityDemand.cityId, cityDemand])
    )
    const shippingNetworkById = new Map(
        residual.problem.shippingCompanyNetworks.map((network) => [network.shippingCompanyId, network])
    )

    return {
        problem: residual.problem,
        originalTarget: deliveryPlan.totalDelivered,
        shippedSoFar,
        deliveredCultivatedAreaIdSet: residual.deliveredCultivatedAreaIdSet,
        zoneById,
        zoneIdByCultivatedAreaId,
        cityDemandById,
        shippingNetworkById
    }
}

export function applyAtomicDeliveryCandidateToProblem(
    problem: DeliveryProblem,
    candidate: AtomicDeliveryCandidate
): DeliveryProblem | null {
    let zoneFound = false
    let cityFound = false
    let shippingNetworkFound = false
    let invalid = false

    const zoneSupplies = problem.zoneSupplies
        .map((zoneSupply) => {
            if (zoneSupply.zoneId !== candidate.zoneId) {
                return zoneSupply
            }
            zoneFound = true
            const remainingSupply = zoneSupply.supply - 1
            if (remainingSupply < 0) {
                invalid = true
                return zoneSupply
            }
            return {
                ...zoneSupply,
                supply: remainingSupply
            }
        })
        .filter((zoneSupply) => zoneSupply.supply > 0)

    const cityDemands = problem.cityDemands
        .map((cityDemand) => {
            if (cityDemand.cityId !== candidate.cityId) {
                return cityDemand
            }
            cityFound = true
            const remainingDemand = cityDemand.remainingDemand - 1
            if (remainingDemand < 0) {
                invalid = true
                return cityDemand
            }
            return {
                ...cityDemand,
                remainingDemand
            }
        })
        .filter((cityDemand) => cityDemand.remainingDemand > 0)

    const shippingCompanyNetworks = problem.shippingCompanyNetworks
        .map((shippingNetwork) => {
            if (shippingNetwork.shippingCompanyId !== candidate.shippingCompanyId) {
                return shippingNetwork
            }

            shippingNetworkFound = true
            const remainingCapacityBySeaAreaId = new Map<IndonesiaNodeId, number>(
                shippingNetwork.seaAreaCapacities.map((seaAreaCapacity) => [
                    seaAreaCapacity.seaAreaId,
                    seaAreaCapacity.capacity
                ])
            )

            for (const seaAreaId of candidate.seaAreaIds) {
                if (!isIndonesiaNodeId(seaAreaId)) {
                    invalid = true
                    continue
                }
                const remainingCapacity = remainingCapacityBySeaAreaId.get(seaAreaId)
                if (remainingCapacity === undefined || remainingCapacity <= 0) {
                    invalid = true
                    continue
                }
                remainingCapacityBySeaAreaId.set(seaAreaId, remainingCapacity - 1)
            }

            const seaAreaCapacities = shippingNetwork.seaAreaCapacities
                .map((seaAreaCapacity) => ({
                    ...seaAreaCapacity,
                    capacity: remainingCapacityBySeaAreaId.get(seaAreaCapacity.seaAreaId) ?? 0
                }))
                .filter((seaAreaCapacity) => seaAreaCapacity.capacity > 0)

            const remainingSeaAreaIdSet = new Set<IndonesiaNodeId>(
                seaAreaCapacities.map((seaAreaCapacity) => seaAreaCapacity.seaAreaId)
            )
            const seaLanes = shippingNetwork.seaLanes.filter(
                (seaLane) =>
                    remainingSeaAreaIdSet.has(seaLane.fromSeaAreaId) &&
                    remainingSeaAreaIdSet.has(seaLane.toSeaAreaId)
            )

            return {
                ...shippingNetwork,
                seaAreaCapacities,
                seaLanes
            }
        })
        .filter((shippingNetwork) => shippingNetwork.seaAreaCapacities.length > 0)

    if (!zoneFound || !cityFound || !shippingNetworkFound || invalid) {
        return null
    }

    return {
        ...problem,
        zoneSupplies,
        cityDemands,
        shippingCompanyNetworks
    }
}

export function isSafeAtomicDeliveryCandidate(
    context: DeliveryOperationContext,
    candidate: AtomicDeliveryCandidate
): boolean {
    const remainingRequiredAfterCandidate =
        context.originalTarget - (context.shippedSoFar + 1)
    if (remainingRequiredAfterCandidate <= 0) {
        return true
    }

    const residualProblem = applyAtomicDeliveryCandidateToProblem(context.problem, candidate)
    if (!residualProblem) {
        return false
    }

    const residualPlan = solveDeliveryProblem(residualProblem)
    return residualPlan.totalDelivered >= remainingRequiredAfterCandidate
}
