import { assert, assertExists } from '@tabletop/common'
import { GOOD_REVENUE_BY_GOOD } from '../definition/operationsEconomy.js'
import {
    isIndonesiaNodeId,
    type IndonesiaNodeId
} from '../utils/indonesiaNodes.js'
import type {
    CityDemand,
    ShippingCompanyNetwork,
    ZoneSupply
} from './deliveryPlan.js'
import type {
    AtomicDeliveryCandidate,
    AtomicDeliveryChoice,
    DeliveryOperationContext
} from './deliveryCandidateTypes.js'
import { seaLaneKey, sortNodeIds } from './deliveryCandidateUtils.js'

function createAtomicDeliveryCandidate(
    context: DeliveryOperationContext,
    zoneId: string,
    cultivatedAreaId: IndonesiaNodeId,
    shippingCompanyId: string,
    seaAreaIds: readonly IndonesiaNodeId[],
    cityId: string
): AtomicDeliveryCandidate {
    const revenue = GOOD_REVENUE_BY_GOOD[context.problem.good]
    const shippingCost = seaAreaIds.length * context.problem.shippingFeePerShipUse
    return {
        zoneId,
        cultivatedAreaId,
        shippingCompanyId,
        seaAreaIds: [...seaAreaIds],
        cityId,
        revenue,
        shippingCost,
        netProfit: revenue - shippingCost
    }
}

function isValidSeaPathForDelivery(
    zoneSupply: ZoneSupply,
    cityDemand: CityDemand,
    shippingNetwork: ShippingCompanyNetwork,
    seaAreaIds: readonly string[]
): seaAreaIds is IndonesiaNodeId[] {
    if (seaAreaIds.length === 0) {
        return false
    }

    const seaAreaCapacityById = new Map<IndonesiaNodeId, number>()
    for (const seaAreaCapacity of shippingNetwork.seaAreaCapacities) {
        seaAreaCapacityById.set(seaAreaCapacity.seaAreaId, seaAreaCapacity.capacity)
    }

    const laneKeySet = new Set<string>(
        shippingNetwork.seaLanes.map((seaLane) =>
            seaLaneKey(seaLane.fromSeaAreaId, seaLane.toSeaAreaId)
        )
    )

    const pathUsageBySeaAreaId = new Map<IndonesiaNodeId, number>()
    const validatedSeaAreaIds: IndonesiaNodeId[] = []
    for (const seaAreaId of seaAreaIds) {
        if (!isIndonesiaNodeId(seaAreaId)) {
            return false
        }

        const remainingCapacity = seaAreaCapacityById.get(seaAreaId)
        if (remainingCapacity === undefined || remainingCapacity <= 0) {
            return false
        }

        const usageCount = (pathUsageBySeaAreaId.get(seaAreaId) ?? 0) + 1
        if (usageCount > remainingCapacity) {
            return false
        }
        pathUsageBySeaAreaId.set(seaAreaId, usageCount)
        validatedSeaAreaIds.push(seaAreaId)
    }

    const firstSeaAreaId = validatedSeaAreaIds[0]
    const lastSeaAreaId = validatedSeaAreaIds[validatedSeaAreaIds.length - 1]
    assertExists(firstSeaAreaId, 'Sea path should have a first sea area')
    assertExists(lastSeaAreaId, 'Sea path should have a last sea area')

    if (!zoneSupply.adjacentSeaAreaIds.includes(firstSeaAreaId)) {
        return false
    }
    if (!cityDemand.adjacentSeaAreaIds.includes(lastSeaAreaId)) {
        return false
    }

    for (let index = 0; index < validatedSeaAreaIds.length - 1; index += 1) {
        const fromSeaAreaId = validatedSeaAreaIds[index]
        const toSeaAreaId = validatedSeaAreaIds[index + 1]
        assertExists(fromSeaAreaId, 'Sea path edge should have a from sea area id')
        assertExists(toSeaAreaId, 'Sea path edge should have a to sea area id')

        if (!laneKeySet.has(seaLaneKey(fromSeaAreaId, toSeaAreaId))) {
            return false
        }
    }

    return true
}

function buildSeaAdjacencyByAreaId(
    shippingNetwork: ShippingCompanyNetwork
): Map<IndonesiaNodeId, IndonesiaNodeId[]> {
    const adjacency = new Map<IndonesiaNodeId, IndonesiaNodeId[]>()
    const seaAreaIds = sortNodeIds(
        shippingNetwork.seaAreaCapacities.map((seaAreaCapacity) => seaAreaCapacity.seaAreaId)
    )
    for (const seaAreaId of seaAreaIds) {
        adjacency.set(seaAreaId, [])
    }

    for (const seaLane of shippingNetwork.seaLanes) {
        const fromNeighbors = adjacency.get(seaLane.fromSeaAreaId)
        const toNeighbors = adjacency.get(seaLane.toSeaAreaId)
        if (!fromNeighbors || !toNeighbors) {
            continue
        }
        fromNeighbors.push(seaLane.toSeaAreaId)
        toNeighbors.push(seaLane.fromSeaAreaId)
    }

    for (const [seaAreaId, neighbors] of adjacency.entries()) {
        adjacency.set(
            seaAreaId,
            sortNodeIds(neighbors)
        )
    }

    return adjacency
}

function shortestSeaPathBetweenSets(
    shippingNetwork: ShippingCompanyNetwork,
    startSeaAreaIds: readonly IndonesiaNodeId[],
    endSeaAreaIds: readonly IndonesiaNodeId[]
): IndonesiaNodeId[] | null {
    const sortedStartSeaAreaIds = sortNodeIds(startSeaAreaIds)
    const endSeaAreaIdSet = new Set<IndonesiaNodeId>(endSeaAreaIds)
    if (sortedStartSeaAreaIds.length === 0 || endSeaAreaIdSet.size === 0) {
        return null
    }

    const adjacency = buildSeaAdjacencyByAreaId(shippingNetwork)
    const queue: IndonesiaNodeId[] = []
    const visited = new Set<IndonesiaNodeId>()
    const parentBySeaAreaId = new Map<IndonesiaNodeId, IndonesiaNodeId | null>()

    for (const seaAreaId of sortedStartSeaAreaIds) {
        if (!adjacency.has(seaAreaId) || visited.has(seaAreaId)) {
            continue
        }

        visited.add(seaAreaId)
        parentBySeaAreaId.set(seaAreaId, null)
        if (endSeaAreaIdSet.has(seaAreaId)) {
            return [seaAreaId]
        }
        queue.push(seaAreaId)
    }

    while (queue.length > 0) {
        const currentSeaAreaId = queue.shift()
        assertExists(currentSeaAreaId, 'Queue should yield a sea area id while pathfinding')

        const neighbors = adjacency.get(currentSeaAreaId) ?? []
        for (const neighborSeaAreaId of neighbors) {
            if (visited.has(neighborSeaAreaId)) {
                continue
            }

            visited.add(neighborSeaAreaId)
            parentBySeaAreaId.set(neighborSeaAreaId, currentSeaAreaId)
            if (endSeaAreaIdSet.has(neighborSeaAreaId)) {
                const path: IndonesiaNodeId[] = []
                let cursor: IndonesiaNodeId | null = neighborSeaAreaId
                while (cursor) {
                    path.unshift(cursor)
                    const parentSeaAreaId = parentBySeaAreaId.get(cursor)
                    assert(
                        parentSeaAreaId !== undefined,
                        `Parent should be defined for visited sea area ${cursor}`
                    )
                    cursor = parentSeaAreaId
                }
                return path
            }

            queue.push(neighborSeaAreaId)
        }
    }

    return null
}

export function atomicDeliveryCandidateForChoice(
    context: DeliveryOperationContext,
    choice: AtomicDeliveryChoice
): AtomicDeliveryCandidate | null {
    const cultivatedAreaId = choice.cultivatedAreaId
    if (!isIndonesiaNodeId(cultivatedAreaId)) {
        return null
    }
    if (context.deliveredCultivatedAreaIdSet.has(cultivatedAreaId)) {
        return null
    }

    const zoneId = context.zoneIdByCultivatedAreaId.get(cultivatedAreaId)
    if (!zoneId) {
        return null
    }
    const zoneSupply = context.zoneById.get(zoneId)
    if (!zoneSupply || zoneSupply.supply <= 0) {
        return null
    }

    const cityDemand = context.cityDemandById.get(choice.cityId)
    if (!cityDemand || cityDemand.remainingDemand <= 0) {
        return null
    }

    const shippingNetwork = context.shippingNetworkById.get(choice.shippingCompanyId)
    if (!shippingNetwork) {
        return null
    }

    if (!isValidSeaPathForDelivery(zoneSupply, cityDemand, shippingNetwork, choice.seaAreaIds)) {
        return null
    }

    return createAtomicDeliveryCandidate(
        context,
        zoneId,
        cultivatedAreaId,
        choice.shippingCompanyId,
        choice.seaAreaIds,
        choice.cityId
    )
}

export function listAtomicDeliveryCandidatesFromContext(
    context: DeliveryOperationContext
): AtomicDeliveryCandidate[] {
    const candidatesByKey = new Map<string, AtomicDeliveryCandidate>()

    for (const zoneSupply of context.problem.zoneSupplies) {
        if (zoneSupply.supply <= 0) {
            continue
        }

        const availableCultivatedAreaIds = sortNodeIds(
            zoneSupply.areaIds.filter(
                (cultivatedAreaId) =>
                    !context.deliveredCultivatedAreaIdSet.has(cultivatedAreaId)
            )
        )
        if (availableCultivatedAreaIds.length === 0) {
            continue
        }

        for (const cityDemand of context.problem.cityDemands) {
            if (cityDemand.remainingDemand <= 0) {
                continue
            }

            for (const shippingNetwork of context.problem.shippingCompanyNetworks) {
                const shippingSeaAreaIdSet = new Set<IndonesiaNodeId>(
                    shippingNetwork.seaAreaCapacities.map(
                        (seaAreaCapacity) => seaAreaCapacity.seaAreaId
                    )
                )
                const startSeaAreaIds = sortNodeIds(
                    zoneSupply.adjacentSeaAreaIds.filter((seaAreaId) =>
                        shippingSeaAreaIdSet.has(seaAreaId)
                    )
                )
                const endSeaAreaIds = sortNodeIds(
                    cityDemand.adjacentSeaAreaIds.filter((seaAreaId) =>
                        shippingSeaAreaIdSet.has(seaAreaId)
                    )
                )
                if (startSeaAreaIds.length === 0 || endSeaAreaIds.length === 0) {
                    continue
                }

                const shortestSeaPath = shortestSeaPathBetweenSets(
                    shippingNetwork,
                    startSeaAreaIds,
                    endSeaAreaIds
                )
                if (!shortestSeaPath) {
                    continue
                }

                for (const cultivatedAreaId of availableCultivatedAreaIds) {
                    const candidate = createAtomicDeliveryCandidate(
                        context,
                        zoneSupply.zoneId,
                        cultivatedAreaId,
                        shippingNetwork.shippingCompanyId,
                        shortestSeaPath,
                        cityDemand.cityId
                    )
                    const key = [
                        candidate.cultivatedAreaId,
                        candidate.shippingCompanyId,
                        candidate.seaAreaIds.join('>'),
                        candidate.cityId
                    ].join('|')
                    candidatesByKey.set(key, candidate)
                }
            }
        }
    }

    return [...candidatesByKey.values()].sort((candidateA, candidateB) => {
        const cultivatedAreaComparison = candidateA.cultivatedAreaId.localeCompare(
            candidateB.cultivatedAreaId
        )
        if (cultivatedAreaComparison !== 0) {
            return cultivatedAreaComparison
        }
        const shippingComparison = candidateA.shippingCompanyId.localeCompare(
            candidateB.shippingCompanyId
        )
        if (shippingComparison !== 0) {
            return shippingComparison
        }
        const cityComparison = candidateA.cityId.localeCompare(candidateB.cityId)
        if (cityComparison !== 0) {
            return cityComparison
        }
        return candidateA.seaAreaIds.join('>').localeCompare(candidateB.seaAreaIds.join('>'))
    })
}
