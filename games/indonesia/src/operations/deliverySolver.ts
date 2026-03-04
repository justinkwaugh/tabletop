import { assert, assertExists } from '@tabletop/common'
import { DeliveryTieBreakPolicy, GOOD_REVENUE_BY_GOOD } from '../definition/operationsEconomy.js'
import type { IndonesiaNodeId } from '../utils/indonesiaNodes.js'
import type {
    CityDelivery,
    CriticalDelivery,
    DeliveryPlan,
    DeliveryProblem,
    ShipUse,
    ShippingPayment
} from './deliveryPlan.js'

type NetworkNode =
    | { kind: 'source' }
    | { kind: 'sink' }
    | { kind: 'zone'; zoneId: string }
    | { kind: 'city'; cityId: string }
    | { kind: 'sea-in'; shippingCompanyId: string; seaAreaId: IndonesiaNodeId }
    | { kind: 'sea-out'; shippingCompanyId: string; seaAreaId: IndonesiaNodeId }

type NetworkEdgeMeta =
    | {
          kind: 'zone-to-sea'
          zoneId: string
          shippingCompanyId: string
          seaAreaId: IndonesiaNodeId
      }
    | {
          kind: 'sea-capacity'
          shippingCompanyId: string
          seaAreaId: IndonesiaNodeId
      }
    | {
          kind: 'sea-to-city'
          shippingCompanyId: string
          cityId: string
          seaAreaId: IndonesiaNodeId
      }
    | {
          kind: 'city-to-sink'
          cityId: string
      }

type FlowEdge = {
    to: number
    rev: number
    capacity: number
    cost: number
    flow: number
    meta?: NetworkEdgeMeta
}

type FlowNetwork = {
    nodes: NetworkNode[]
    adjacency: FlowEdge[][]
}

type AugmentationPath = {
    amount: number
    edges: {
        from: number
        edge: FlowEdge
    }[]
}

type MinCostMaxFlowResult = {
    flow: number
    cost: number
    augmentations: AugmentationPath[]
}

export type DeliverySolveStats = {
    iterations: number
    elapsedMilliseconds: number
    totalFlow: number
    totalCost: number
}

export type DeliverySolveResult = {
    plan: DeliveryPlan
    stats: DeliverySolveStats
}

function createFlowNetwork(): FlowNetwork {
    return {
        nodes: [],
        adjacency: []
    }
}

function addNode(network: FlowNetwork, node: NetworkNode): number {
    const nodeIndex = network.nodes.length
    network.nodes.push(node)
    network.adjacency.push([])
    return nodeIndex
}

function addEdge(
    network: FlowNetwork,
    from: number,
    to: number,
    capacity: number,
    cost: number,
    meta?: NetworkEdgeMeta
): void {
    const forwardEdge: FlowEdge = {
        to,
        rev: network.adjacency[to].length,
        capacity,
        cost,
        flow: 0,
        meta
    }
    const backwardEdge: FlowEdge = {
        to: from,
        rev: network.adjacency[from].length,
        capacity: 0,
        cost: -cost,
        flow: 0
    }
    network.adjacency[from].push(forwardEdge)
    network.adjacency[to].push(backwardEdge)
}

function nodeKey(node: NetworkNode): string {
    switch (node.kind) {
        case 'source':
        case 'sink': {
            return node.kind
        }
        case 'zone': {
            return `zone:${node.zoneId}`
        }
        case 'city': {
            return `city:${node.cityId}`
        }
        case 'sea-in': {
            return `sea-in:${node.shippingCompanyId}:${node.seaAreaId}`
        }
        case 'sea-out': {
            return `sea-out:${node.shippingCompanyId}:${node.seaAreaId}`
        }
    }
}

function maxPossibleTotalShippingCost(problem: DeliveryProblem): number {
    let totalSeaCapacity = 0
    for (const shippingNetwork of problem.shippingCompanyNetworks) {
        for (const seaAreaCapacity of shippingNetwork.seaAreaCapacities) {
            totalSeaCapacity += seaAreaCapacity.capacity
        }
    }

    return totalSeaCapacity * problem.shippingFeePerShipUse
}

function seaCapacityEdgeCost(
    problem: DeliveryProblem,
    shippingCompanyId: string,
    ownedShippingCompanyIdSet: ReadonlySet<string>,
    nonOwnedCostScale: number
): number {
    if (problem.tieBreakPolicy !== DeliveryTieBreakPolicy.MinShippingCost) {
        return 0
    }

    // Lexicographic objective encoding (within fixed max-delivery):
    // 1) maximize profit for production owner => minimize non-owned shipping cost
    // 2) then minimize total shipping cost
    const totalShippingCostComponent = problem.shippingFeePerShipUse
    const nonOwnedShippingCostComponent = ownedShippingCompanyIdSet.has(shippingCompanyId)
        ? 0
        : problem.shippingFeePerShipUse

    return nonOwnedShippingCostComponent * nonOwnedCostScale + totalShippingCostComponent
}

function sortIds<T extends string>(ids: readonly T[]): T[] {
    return [...ids].sort((a, b) => a.localeCompare(b))
}

function buildFlowNetwork(problem: DeliveryProblem): {
    network: FlowNetwork
    sourceIndex: number
    sinkIndex: number
} {
    const network = createFlowNetwork()
    const nodeIndexByKey = new Map<string, number>()

    const sourceIndex = addNode(network, { kind: 'source' })
    nodeIndexByKey.set('source', sourceIndex)
    const sinkIndex = addNode(network, { kind: 'sink' })
    nodeIndexByKey.set('sink', sinkIndex)

    const totalSupply = problem.zoneSupplies.reduce((sum, zoneSupply) => sum + zoneSupply.supply, 0)
    const totalDemand = problem.cityDemands.reduce((sum, cityDemand) => sum + cityDemand.remainingDemand, 0)
    const unrestrictedCapacity = Math.max(1, totalSupply, totalDemand)

    const zoneNodeIndexByZoneId = new Map<string, number>()
    const sortedZoneSupplies = [...problem.zoneSupplies].sort((a, b) => a.zoneId.localeCompare(b.zoneId))
    for (const zoneSupply of sortedZoneSupplies) {
        const node: NetworkNode = {
            kind: 'zone',
            zoneId: zoneSupply.zoneId
        }
        const zoneNodeIndex = addNode(network, node)
        nodeIndexByKey.set(nodeKey(node), zoneNodeIndex)
        zoneNodeIndexByZoneId.set(zoneSupply.zoneId, zoneNodeIndex)
        addEdge(network, sourceIndex, zoneNodeIndex, zoneSupply.supply, 0)
    }

    const cityNodeIndexByCityId = new Map<string, number>()
    const sortedCityDemands = [...problem.cityDemands].sort((a, b) => a.cityId.localeCompare(b.cityId))
    for (const cityDemand of sortedCityDemands) {
        const node: NetworkNode = {
            kind: 'city',
            cityId: cityDemand.cityId
        }
        const cityNodeIndex = addNode(network, node)
        nodeIndexByKey.set(nodeKey(node), cityNodeIndex)
        cityNodeIndexByCityId.set(cityDemand.cityId, cityNodeIndex)
        addEdge(
            network,
            cityNodeIndex,
            sinkIndex,
            cityDemand.remainingDemand,
            0,
            {
                kind: 'city-to-sink',
                cityId: cityDemand.cityId
            }
        )
    }

    const sortedShippingNetworks = [...problem.shippingCompanyNetworks].sort((a, b) =>
        a.shippingCompanyId.localeCompare(b.shippingCompanyId)
    )
    const ownedShippingCompanyIdSet = new Set(problem.ownedShippingCompanyIds)
    const nonOwnedCostScale = maxPossibleTotalShippingCost(problem) + 1

    for (const shippingNetwork of sortedShippingNetworks) {
        const seaInNodeIndexBySeaAreaId = new Map<IndonesiaNodeId, number>()
        const seaOutNodeIndexBySeaAreaId = new Map<IndonesiaNodeId, number>()

        const sortedSeaAreaCapacities = [...shippingNetwork.seaAreaCapacities].sort((a, b) =>
            a.seaAreaId.localeCompare(b.seaAreaId)
        )

        for (const seaAreaCapacity of sortedSeaAreaCapacities) {
            const seaInNode: NetworkNode = {
                kind: 'sea-in',
                shippingCompanyId: shippingNetwork.shippingCompanyId,
                seaAreaId: seaAreaCapacity.seaAreaId
            }
            const seaOutNode: NetworkNode = {
                kind: 'sea-out',
                shippingCompanyId: shippingNetwork.shippingCompanyId,
                seaAreaId: seaAreaCapacity.seaAreaId
            }

            const seaInNodeIndex = addNode(network, seaInNode)
            const seaOutNodeIndex = addNode(network, seaOutNode)
            nodeIndexByKey.set(nodeKey(seaInNode), seaInNodeIndex)
            nodeIndexByKey.set(nodeKey(seaOutNode), seaOutNodeIndex)
            seaInNodeIndexBySeaAreaId.set(seaAreaCapacity.seaAreaId, seaInNodeIndex)
            seaOutNodeIndexBySeaAreaId.set(seaAreaCapacity.seaAreaId, seaOutNodeIndex)

            addEdge(
                network,
                seaInNodeIndex,
                seaOutNodeIndex,
                seaAreaCapacity.capacity,
                seaCapacityEdgeCost(
                    problem,
                    shippingNetwork.shippingCompanyId,
                    ownedShippingCompanyIdSet,
                    nonOwnedCostScale
                ),
                {
                    kind: 'sea-capacity',
                    shippingCompanyId: shippingNetwork.shippingCompanyId,
                    seaAreaId: seaAreaCapacity.seaAreaId
                }
            )
        }

        const seaAreaIdsWithCapacity = new Set<IndonesiaNodeId>(seaInNodeIndexBySeaAreaId.keys())

        for (const zoneSupply of sortedZoneSupplies) {
            const zoneNodeIndex = zoneNodeIndexByZoneId.get(zoneSupply.zoneId)
            assertExists(zoneNodeIndex, `Zone node should exist for ${zoneSupply.zoneId}`)

            const zoneAdjacentSeaAreaIds = sortIds(zoneSupply.adjacentSeaAreaIds)
            for (const seaAreaId of zoneAdjacentSeaAreaIds) {
                if (!seaAreaIdsWithCapacity.has(seaAreaId)) {
                    continue
                }
                const seaInNodeIndex = seaInNodeIndexBySeaAreaId.get(seaAreaId)
                assertExists(seaInNodeIndex, `Sea-in node should exist for ${seaAreaId}`)
                addEdge(network, zoneNodeIndex, seaInNodeIndex, zoneSupply.supply, 0, {
                    kind: 'zone-to-sea',
                    zoneId: zoneSupply.zoneId,
                    shippingCompanyId: shippingNetwork.shippingCompanyId,
                    seaAreaId
                })
            }
        }

        const sortedSeaLanes = [...shippingNetwork.seaLanes].sort((a, b) => {
            const fromComparison = a.fromSeaAreaId.localeCompare(b.fromSeaAreaId)
            if (fromComparison !== 0) {
                return fromComparison
            }

            return a.toSeaAreaId.localeCompare(b.toSeaAreaId)
        })
        for (const seaLane of sortedSeaLanes) {
            if (
                !seaAreaIdsWithCapacity.has(seaLane.fromSeaAreaId) ||
                !seaAreaIdsWithCapacity.has(seaLane.toSeaAreaId)
            ) {
                continue
            }

            const fromOutNodeIndex = seaOutNodeIndexBySeaAreaId.get(seaLane.fromSeaAreaId)
            const toInNodeIndex = seaInNodeIndexBySeaAreaId.get(seaLane.toSeaAreaId)
            const toOutNodeIndex = seaOutNodeIndexBySeaAreaId.get(seaLane.toSeaAreaId)
            const fromInNodeIndex = seaInNodeIndexBySeaAreaId.get(seaLane.fromSeaAreaId)

            assertExists(fromOutNodeIndex, `Sea-out node should exist for ${seaLane.fromSeaAreaId}`)
            assertExists(toInNodeIndex, `Sea-in node should exist for ${seaLane.toSeaAreaId}`)
            assertExists(toOutNodeIndex, `Sea-out node should exist for ${seaLane.toSeaAreaId}`)
            assertExists(fromInNodeIndex, `Sea-in node should exist for ${seaLane.fromSeaAreaId}`)

            addEdge(network, fromOutNodeIndex, toInNodeIndex, unrestrictedCapacity, 0)
            addEdge(network, toOutNodeIndex, fromInNodeIndex, unrestrictedCapacity, 0)
        }

        for (const cityDemand of sortedCityDemands) {
            const cityNodeIndex = cityNodeIndexByCityId.get(cityDemand.cityId)
            assertExists(cityNodeIndex, `City node should exist for ${cityDemand.cityId}`)

            const adjacentCitySeaAreaIds = sortIds(cityDemand.adjacentSeaAreaIds)
            for (const adjacentSeaAreaId of adjacentCitySeaAreaIds) {
                if (!seaAreaIdsWithCapacity.has(adjacentSeaAreaId)) {
                    continue
                }

                const seaOutNodeIndex = seaOutNodeIndexBySeaAreaId.get(adjacentSeaAreaId)
                assertExists(
                    seaOutNodeIndex,
                    `Sea-out node should exist for adjacent city sea area ${adjacentSeaAreaId}`
                )

                addEdge(network, seaOutNodeIndex, cityNodeIndex, cityDemand.remainingDemand, 0, {
                    kind: 'sea-to-city',
                    shippingCompanyId: shippingNetwork.shippingCompanyId,
                    cityId: cityDemand.cityId,
                    seaAreaId: adjacentSeaAreaId
                })
            }
        }
    }

    return {
        network,
        sourceIndex,
        sinkIndex
    }
}

function runMinCostMaxFlow(
    network: FlowNetwork,
    sourceIndex: number,
    sinkIndex: number
): MinCostMaxFlowResult {
    const nodeCount = network.nodes.length
    const potentials = Array.from({ length: nodeCount }, () => 0)
    let totalFlow = 0
    let totalCost = 0
    const augmentations: AugmentationPath[] = []

    while (true) {
        const distance = Array.from({ length: nodeCount }, () => Number.POSITIVE_INFINITY)
        const parentNode = Array.from({ length: nodeCount }, () => -1)
        const parentEdgeIndex = Array.from({ length: nodeCount }, () => -1)
        const visited = Array.from({ length: nodeCount }, () => false)
        distance[sourceIndex] = 0

        for (let iterations = 0; iterations < nodeCount; iterations += 1) {
            let currentNode = -1
            let currentDistance = Number.POSITIVE_INFINITY

            for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
                if (visited[nodeIndex]) {
                    continue
                }
                if (distance[nodeIndex] >= currentDistance) {
                    continue
                }

                currentDistance = distance[nodeIndex]
                currentNode = nodeIndex
            }

            if (currentNode < 0) {
                break
            }

            visited[currentNode] = true
            const edges = network.adjacency[currentNode]
            for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
                const edge = edges[edgeIndex]
                const residualCapacity = edge.capacity - edge.flow
                if (residualCapacity <= 0) {
                    continue
                }

                const reducedCost = edge.cost + potentials[currentNode] - potentials[edge.to]
                const candidateDistance = distance[currentNode] + reducedCost
                if (candidateDistance >= distance[edge.to]) {
                    continue
                }

                distance[edge.to] = candidateDistance
                parentNode[edge.to] = currentNode
                parentEdgeIndex[edge.to] = edgeIndex
            }
        }

        if (parentNode[sinkIndex] < 0) {
            break
        }

        for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
            if (distance[nodeIndex] < Number.POSITIVE_INFINITY) {
                potentials[nodeIndex] += distance[nodeIndex]
            }
        }

        let augmentAmount = Number.POSITIVE_INFINITY
        const pathEdgesReversed: {
            from: number
            edge: FlowEdge
        }[] = []

        let cursorNode = sinkIndex
        while (cursorNode !== sourceIndex) {
            const fromNode = parentNode[cursorNode]
            const edgeIndex = parentEdgeIndex[cursorNode]
            assert(fromNode >= 0, 'Parent node should exist while reconstructing augmentation path')
            assert(
                edgeIndex >= 0,
                'Parent edge index should exist while reconstructing augmentation path'
            )
            const edge = network.adjacency[fromNode][edgeIndex]
            assertExists(edge, 'Parent edge should exist while reconstructing augmentation path')

            const residualCapacity = edge.capacity - edge.flow
            if (residualCapacity < augmentAmount) {
                augmentAmount = residualCapacity
            }

            pathEdgesReversed.push({
                from: fromNode,
                edge
            })
            cursorNode = fromNode
        }

        assert(
            Number.isFinite(augmentAmount) && augmentAmount > 0,
            'Augment amount should be a finite positive number'
        )

        let pathCost = 0
        const pathEdges = [...pathEdgesReversed].reverse()
        for (const pathEdge of pathEdges) {
            const forwardEdge = pathEdge.edge
            forwardEdge.flow += augmentAmount
            const reverseEdge = network.adjacency[forwardEdge.to][forwardEdge.rev]
            assertExists(reverseEdge, 'Reverse edge should exist while augmenting flow')
            reverseEdge.flow -= augmentAmount
            pathCost += forwardEdge.cost
        }

        totalFlow += augmentAmount
        totalCost += augmentAmount * pathCost
        augmentations.push({
            amount: augmentAmount,
            edges: pathEdges
        })
    }

    return {
        flow: totalFlow,
        cost: totalCost,
        augmentations
    }
}

function sortShipUses(shipUses: readonly ShipUse[]): ShipUse[] {
    return [...shipUses].sort((a, b) => {
        const companyComparison = a.shippingCompanyId.localeCompare(b.shippingCompanyId)
        if (companyComparison !== 0) {
            return companyComparison
        }

        return a.seaAreaId.localeCompare(b.seaAreaId)
    })
}

function solveFromAugmentations(
    problem: DeliveryProblem,
    result: MinCostMaxFlowResult
): DeliveryPlan {
    const deliveryByKey = new Map<string, CityDelivery>()
    const shipUseByKey = new Map<string, ShipUse>()

    for (const augmentation of result.augmentations) {
        let zoneId: string | null = null
        let cityId: string | null = null
        let shippingCompanyId: string | null = null
        const seaPathAreaIds: IndonesiaNodeId[] = []

        for (const pathEdge of augmentation.edges) {
            const edgeMeta = pathEdge.edge.meta
            if (!edgeMeta) {
                continue
            }

            if (edgeMeta.kind === 'zone-to-sea') {
                zoneId = edgeMeta.zoneId
                shippingCompanyId = edgeMeta.shippingCompanyId
                continue
            }

            if (edgeMeta.kind === 'sea-capacity') {
                shippingCompanyId = edgeMeta.shippingCompanyId
                seaPathAreaIds.push(edgeMeta.seaAreaId)

                const shipUseKey = `${edgeMeta.shippingCompanyId}|${edgeMeta.seaAreaId}`
                const existingShipUse = shipUseByKey.get(shipUseKey)
                if (existingShipUse) {
                    existingShipUse.uses += augmentation.amount
                } else {
                    shipUseByKey.set(shipUseKey, {
                        shippingCompanyId: edgeMeta.shippingCompanyId,
                        seaAreaId: edgeMeta.seaAreaId,
                        uses: augmentation.amount
                    })
                }
                continue
            }

            if (edgeMeta.kind === 'sea-to-city') {
                cityId = edgeMeta.cityId
                shippingCompanyId = edgeMeta.shippingCompanyId
            }
        }

        assertExists(zoneId, 'Zone should be resolved from augmentation path')
        assertExists(cityId, 'City should be resolved from augmentation path')
        assertExists(shippingCompanyId, 'Shipping company should be resolved from augmentation path')

        const deliveryKey = `${zoneId}|${cityId}|${shippingCompanyId}|${seaPathAreaIds.join('>')}`
        const existingDelivery = deliveryByKey.get(deliveryKey)
        if (existingDelivery) {
            existingDelivery.quantity += augmentation.amount
            continue
        }

        deliveryByKey.set(deliveryKey, {
            zoneId,
            cityId,
            shippingCompanyId,
            quantity: augmentation.amount,
            seaPathAreaIds
        })
    }

    const deliveries = [...deliveryByKey.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map((entry) => entry[1])

    const shipUses = sortShipUses([...shipUseByKey.values()])

    const shippingPaymentsByCompanyId = new Map<string, number>()
    for (const shipUse of shipUses) {
        const currentAmount = shippingPaymentsByCompanyId.get(shipUse.shippingCompanyId) ?? 0
        const nextAmount = currentAmount + shipUse.uses * problem.shippingFeePerShipUse
        shippingPaymentsByCompanyId.set(shipUse.shippingCompanyId, nextAmount)
    }

    const shippingPayments: ShippingPayment[] = [...shippingPaymentsByCompanyId.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map((entry) => ({
            shippingCompanyId: entry[0],
            amount: entry[1]
        }))

    const totalDelivered = result.flow
    const revenue = totalDelivered * GOOD_REVENUE_BY_GOOD[problem.good]
    const shippingCost = shippingPayments.reduce((sum, payment) => sum + payment.amount, 0)
    const netIncome = revenue - shippingCost

    return {
        operatingCompanyId: problem.operatingCompanyId,
        good: problem.good,
        deliveries,
        shipUses,
        shippingPayments,
        totalDelivered,
        revenue,
        shippingCost,
        netIncome,
        tieBreakResult: {
            policy: problem.tieBreakPolicy,
            deliveredGoods: totalDelivered,
            shippingCost
        }
    }
}

function cloneDeliveryProblem(problem: DeliveryProblem): DeliveryProblem {
    return {
        ...problem,
        zoneSupplies: problem.zoneSupplies.map((zoneSupply) => ({
            ...zoneSupply,
            areaIds: [...zoneSupply.areaIds],
            adjacentSeaAreaIds: [...zoneSupply.adjacentSeaAreaIds]
        })),
        cityDemands: problem.cityDemands.map((cityDemand) => ({
            ...cityDemand,
            adjacentSeaAreaIds: [...cityDemand.adjacentSeaAreaIds]
        })),
        shippingCompanyNetworks: problem.shippingCompanyNetworks.map((shippingNetwork) => ({
            ...shippingNetwork,
            seaLanes: shippingNetwork.seaLanes.map((seaLane) => ({ ...seaLane })),
            seaAreaCapacities: shippingNetwork.seaAreaCapacities.map((seaAreaCapacity) => ({
                ...seaAreaCapacity
            }))
        }))
    }
}

function reducePathCapacityForDelivery(problem: DeliveryProblem, delivery: CityDelivery): DeliveryProblem {
    const reduced = cloneDeliveryProblem(problem)
    const pathSeaAreaIds = new Set(delivery.seaPathAreaIds)

    reduced.shippingCompanyNetworks = reduced.shippingCompanyNetworks.map((shippingNetwork) => {
        if (shippingNetwork.shippingCompanyId !== delivery.shippingCompanyId) {
            return shippingNetwork
        }

        const seaAreaCapacities = shippingNetwork.seaAreaCapacities
            .map((seaAreaCapacity) => {
                if (!pathSeaAreaIds.has(seaAreaCapacity.seaAreaId)) {
                    return seaAreaCapacity
                }

                return {
                    ...seaAreaCapacity,
                    capacity: Math.max(0, seaAreaCapacity.capacity - delivery.quantity)
                }
            })
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

    reduced.shippingCompanyNetworks = reduced.shippingCompanyNetworks.filter(
        (shippingNetwork) => shippingNetwork.seaAreaCapacities.length > 0
    )

    return reduced
}

function computeCriticalDeliveries(problem: DeliveryProblem, plan: DeliveryPlan): CriticalDelivery[] {
    if (plan.deliveries.length === 0) {
        return []
    }

    const criticalDeliveries: CriticalDelivery[] = []
    for (const delivery of plan.deliveries) {
        // Conservative criticality pass:
        // remove the solved delivery path's sea-capacity footprint and re-solve.
        // If the plan can no longer deliver the same quantity for this route, that quantity is required.
        const problemWithoutDeliveryPath = reducePathCapacityForDelivery(problem, delivery)
        const replacementPlan = solveDeliveryProblem(problemWithoutDeliveryPath, {
            includeCriticalDeliveries: false
        })
        const replaceableQuantity = Math.min(delivery.quantity, replacementPlan.totalDelivered)
        const requiredQuantity = Math.max(0, delivery.quantity - replaceableQuantity)
        if (requiredQuantity <= 0) {
            continue
        }

        criticalDeliveries.push({
            zoneId: delivery.zoneId,
            cityId: delivery.cityId,
            shippingCompanyId: delivery.shippingCompanyId,
            seaPathAreaIds: [...delivery.seaPathAreaIds],
            plannedQuantity: delivery.quantity,
            requiredQuantity
        })
    }

    return criticalDeliveries.sort((criticalDeliveryA, criticalDeliveryB) => {
        const zoneComparison = criticalDeliveryA.zoneId.localeCompare(criticalDeliveryB.zoneId)
        if (zoneComparison !== 0) {
            return zoneComparison
        }

        const cityComparison = criticalDeliveryA.cityId.localeCompare(criticalDeliveryB.cityId)
        if (cityComparison !== 0) {
            return cityComparison
        }

        const shippingComparison = criticalDeliveryA.shippingCompanyId.localeCompare(
            criticalDeliveryB.shippingCompanyId
        )
        if (shippingComparison !== 0) {
            return shippingComparison
        }

        return criticalDeliveryA.seaPathAreaIds
            .join('>')
            .localeCompare(criticalDeliveryB.seaPathAreaIds.join('>'))
    })
}

type SolveDeliveryProblemOptions = {
    includeCriticalDeliveries?: boolean
}

export function solveDeliveryProblem(
    problem: DeliveryProblem,
    options?: SolveDeliveryProblemOptions
): DeliveryPlan {
    return solveDeliveryProblemWithStats(problem, options).plan
}

export function solveDeliveryProblemWithStats(
    problem: DeliveryProblem,
    options?: SolveDeliveryProblemOptions
): DeliverySolveResult {
    const built = buildFlowNetwork(problem)
    const startedAtMilliseconds = Date.now()
    const solved = runMinCostMaxFlow(built.network, built.sourceIndex, built.sinkIndex)
    const endedAtMilliseconds = Date.now()
    const planWithoutCritical = solveFromAugmentations(problem, solved)
    const includeCriticalDeliveries = options?.includeCriticalDeliveries ?? true
    const criticalDeliveries = includeCriticalDeliveries
        ? computeCriticalDeliveries(problem, planWithoutCritical)
        : undefined

    return {
        plan: {
            ...planWithoutCritical,
            ...(criticalDeliveries && criticalDeliveries.length > 0
                ? { criticalDeliveries }
                : {})
        },
        stats: {
            iterations: solved.augmentations.length,
            elapsedMilliseconds: endedAtMilliseconds - startedAtMilliseconds,
            totalFlow: solved.flow,
            totalCost: solved.cost
        }
    }
}
