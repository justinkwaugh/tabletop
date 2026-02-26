import { assert, assertExists } from '@tabletop/common'
import { isCultivatedArea, isSeaArea } from '../components/area.js'
import { isProductionCompany, isShippingCompany } from '../components/company.js'
import { DEFAULT_DELIVERY_TIE_BREAK_POLICY, SHIPPING_FEE_PER_SHIP_USE } from '../definition/operationsEconomy.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import {
    IndonesiaAreaType,
    IndonesiaNeighborDirection,
    isIndonesiaNodeId,
    type IndonesiaNodeId
} from '../utils/indonesiaNodes.js'
import type {
    CityDemand,
    DeliveryProblem,
    SeaAreaCapacity,
    SeaLane,
    ShippingCompanyNetwork,
    ZoneSupply
} from './deliveryPlan.js'

function sortNodeIds(nodeIds: readonly IndonesiaNodeId[]): IndonesiaNodeId[] {
    return [...nodeIds].sort((a, b) => a.localeCompare(b))
}

function canonicalSeaLaneEdge(
    seaAreaIdA: IndonesiaNodeId,
    seaAreaIdB: IndonesiaNodeId
): SeaLane {
    if (seaAreaIdA.localeCompare(seaAreaIdB) <= 0) {
        return {
            fromSeaAreaId: seaAreaIdA,
            toSeaAreaId: seaAreaIdB
        }
    }

    return {
        fromSeaAreaId: seaAreaIdB,
        toSeaAreaId: seaAreaIdA
    }
}

function buildProductionZoneSupplies(
    state: HydratedIndonesiaGameState,
    operatingCompanyId: string
): ZoneSupply[] {
    const cultivatedAreaIdSet = new Set<IndonesiaNodeId>()
    for (const area of Object.values(state.board.areas)) {
        if (!isCultivatedArea(area) || area.companyId !== operatingCompanyId) {
            continue
        }

        assert(isIndonesiaNodeId(area.id), `Cultivated area ${area.id} should be a valid node id`)
        cultivatedAreaIdSet.add(area.id)
    }

    const unvisited = sortNodeIds([...cultivatedAreaIdSet])
    const zoneAreaIdGroups: IndonesiaNodeId[][] = []

    while (unvisited.length > 0) {
        const seedAreaId = unvisited.shift()
        assertExists(seedAreaId, 'Seed area should exist while building production zones')

        const queue: IndonesiaNodeId[] = [seedAreaId]
        const zoneAreaIds: IndonesiaNodeId[] = []
        const remaining = new Set(unvisited)
        remaining.delete(seedAreaId)

        while (queue.length > 0) {
            const currentAreaId = queue.shift()
            assertExists(currentAreaId, 'Queue area id should exist while building production zones')
            zoneAreaIds.push(currentAreaId)

            const currentNode = state.board.graph.nodeById(currentAreaId)
            assertExists(
                currentNode,
                `Node ${currentAreaId} should exist while building production zones`
            )

            for (const neighborNode of state.board.graph.neighborsOf(
                currentNode,
                IndonesiaNeighborDirection.Land
            )) {
                if (neighborNode.type !== IndonesiaAreaType.Land) {
                    continue
                }
                if (!remaining.has(neighborNode.id)) {
                    continue
                }

                remaining.delete(neighborNode.id)
                queue.push(neighborNode.id)
            }
        }

        const remainingSorted = sortNodeIds([...remaining])
        unvisited.splice(0, unvisited.length, ...remainingSorted)
        zoneAreaIdGroups.push(sortNodeIds(zoneAreaIds))
    }

    const sortedZoneAreaGroups = [...zoneAreaIdGroups].sort((groupA, groupB) =>
        groupA[0].localeCompare(groupB[0])
    )

    return sortedZoneAreaGroups.map((areaIds, index) => {
        const adjacentSeaAreaIds = new Set<IndonesiaNodeId>()
        for (const areaId of areaIds) {
            const node = state.board.graph.nodeById(areaId)
            assertExists(node, `Node ${areaId} should exist while collecting adjacent sea areas`)

            for (const seaNeighborId of node.neighbors[IndonesiaNeighborDirection.Sea]) {
                const seaNode = state.board.graph.nodeById(seaNeighborId)
                if (!seaNode || seaNode.type !== IndonesiaAreaType.Sea) {
                    continue
                }
                adjacentSeaAreaIds.add(seaNeighborId)
            }
        }

        return {
            zoneId: `${operatingCompanyId}:zone:${index + 1}`,
            areaIds,
            adjacentSeaAreaIds: sortNodeIds([...adjacentSeaAreaIds]),
            supply: areaIds.length
        }
    })
}

function buildCityDemands(
    state: HydratedIndonesiaGameState,
    good: DeliveryProblem['good']
): CityDemand[] {
    const cityDemands: CityDemand[] = []

    for (const city of state.board.cities) {
        const remainingDemand = state.remainingCityDemandForGood(city, good)
        if (remainingDemand <= 0) {
            continue
        }

        assert(isIndonesiaNodeId(city.area), `City area ${city.area} should be a valid node id`)
        const cityNode = state.board.graph.nodeById(city.area)
        assertExists(cityNode, `City area node ${city.area} should exist`)

        const adjacentSeaAreaIds = new Set<IndonesiaNodeId>()
        for (const seaNeighborId of cityNode.neighbors[IndonesiaNeighborDirection.Sea]) {
            const seaNode = state.board.graph.nodeById(seaNeighborId)
            if (!seaNode || seaNode.type !== IndonesiaAreaType.Sea) {
                continue
            }
            adjacentSeaAreaIds.add(seaNeighborId)
        }

        cityDemands.push({
            cityId: city.id,
            cityAreaId: city.area,
            adjacentSeaAreaIds: sortNodeIds([...adjacentSeaAreaIds]),
            remainingDemand
        })
    }

    return cityDemands.sort((demandA, demandB) => demandA.cityId.localeCompare(demandB.cityId))
}

function buildShippingCompanyNetworks(state: HydratedIndonesiaGameState): ShippingCompanyNetwork[] {
    const networks: ShippingCompanyNetwork[] = []
    const shippingCompanies = state.companies
        .filter((company) => isShippingCompany(company))
        .sort((companyA, companyB) => companyA.id.localeCompare(companyB.id))

    for (const shippingCompany of shippingCompanies) {
        const shipCountBySeaAreaId = new Map<IndonesiaNodeId, number>()
        for (const area of Object.values(state.board.areas)) {
            if (!isSeaArea(area)) {
                continue
            }

            const shipCount = area.ships.filter(
                (shipCompanyId) => shipCompanyId === shippingCompany.id
            ).length
            if (shipCount <= 0) {
                continue
            }

            assert(isIndonesiaNodeId(area.id), `Sea area ${area.id} should be a valid node id`)
            shipCountBySeaAreaId.set(area.id, shipCount)
        }

        if (shipCountBySeaAreaId.size === 0) {
            continue
        }

        const ownerHullLevel = state.getPlayerState(shippingCompany.owner).research.hull
        const capacityPerShip = 1 + ownerHullLevel
        const seaAreaCapacities: SeaAreaCapacity[] = sortNodeIds([...shipCountBySeaAreaId.keys()]).map(
            (seaAreaId) => {
                const shipCount = shipCountBySeaAreaId.get(seaAreaId)
                assertExists(
                    shipCount,
                    `Ship count should exist for sea area ${seaAreaId} when building capacities`
                )

                return {
                    seaAreaId,
                    capacity: shipCount * capacityPerShip
                }
            }
        )

        const companySeaAreaIdSet = new Set(shipCountBySeaAreaId.keys())
        const seaLaneByKey = new Map<string, SeaLane>()
        for (const seaAreaId of companySeaAreaIdSet) {
            const seaNode = state.board.graph.nodeById(seaAreaId)
            assertExists(seaNode, `Sea node ${seaAreaId} should exist while building sea lanes`)
            assert(
                seaNode.type === IndonesiaAreaType.Sea,
                `Node ${seaAreaId} should be a sea node while building sea lanes`
            )

            for (const neighborNode of state.board.graph.neighborsOf(
                seaNode,
                IndonesiaNeighborDirection.Sea
            )) {
                if (!companySeaAreaIdSet.has(neighborNode.id)) {
                    continue
                }

                const seaLane = canonicalSeaLaneEdge(seaAreaId, neighborNode.id)
                const key = `${seaLane.fromSeaAreaId}|${seaLane.toSeaAreaId}`
                seaLaneByKey.set(key, seaLane)
            }
        }

        const seaLanes: SeaLane[] = [...seaLaneByKey.values()].sort((laneA, laneB) => {
            const fromComparison = laneA.fromSeaAreaId.localeCompare(laneB.fromSeaAreaId)
            if (fromComparison !== 0) {
                return fromComparison
            }

            return laneA.toSeaAreaId.localeCompare(laneB.toSeaAreaId)
        })

        networks.push({
            shippingCompanyId: shippingCompany.id,
            seaLanes,
            seaAreaCapacities
        })
    }

    return networks
}

function buildOwnedShippingCompanyIds(
    state: HydratedIndonesiaGameState,
    ownerId: string
): string[] {
    return state.companies
        .filter((company) => isShippingCompany(company) && company.owner === ownerId)
        .map((company) => company.id)
        .sort((companyIdA, companyIdB) => companyIdA.localeCompare(companyIdB))
}

export function buildDeliveryProblem(
    state: HydratedIndonesiaGameState,
    operatingCompanyId: string
): DeliveryProblem {
    const operatingCompany = state.companies.find((company) => company.id === operatingCompanyId)
    assertExists(
        operatingCompany,
        `Operating company ${operatingCompanyId} should exist while building delivery problem`
    )
    assert(
        isProductionCompany(operatingCompany),
        `Operating company ${operatingCompanyId} should be a production company while building delivery problem`
    )

    return {
        operatingCompanyId: operatingCompany.id,
        operatingCompanyOwnerId: operatingCompany.owner,
        ownedShippingCompanyIds: buildOwnedShippingCompanyIds(state, operatingCompany.owner),
        good: operatingCompany.good,
        shippingFeePerShipUse: SHIPPING_FEE_PER_SHIP_USE,
        tieBreakPolicy: DEFAULT_DELIVERY_TIE_BREAK_POLICY,
        zoneSupplies: buildProductionZoneSupplies(state, operatingCompany.id),
        cityDemands: buildCityDemands(state, operatingCompany.good),
        shippingCompanyNetworks: buildShippingCompanyNetworks(state)
    }
}
