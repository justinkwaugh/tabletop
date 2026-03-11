import { CompanyType, IndonesiaNeighborDirection, isIndonesiaNodeId } from '@tabletop/indonesia'

export type DeliverySelectableZone = {
    key: string
    companyId: string
    allAreaIds: readonly string[]
    remainingAreaIds: readonly string[]
}

export type DeliverySelectableZoneMarker = {
    key: string
    zoneKey: string
    x: number
    y: number
}

type BoardAreaLike = {
    id: string
    companyId?: string
}

type BoardNodeLike = {
    id: string
}

type BoardGraphLike = {
    nodeById(nodeId: string): BoardNodeLike | null | undefined
    neighborsOf(node: BoardNodeLike, direction: IndonesiaNeighborDirection): BoardNodeLike[]
}

type ProductionMarkerLike = {
    key: string
    companyId: string
    zoneAreaIds: readonly string[]
    x: number
    y: number
}

function compareAreaIds(left: string, right: string): number {
    return left.localeCompare(right, undefined, { numeric: true })
}

export function deriveDeliverySelectableZones(params: {
    enabled: boolean
    deliverySelectionStage: 'cultivated' | 'city' | 'shipping' | 'none'
    operatingCompanyId: string | null
    operatingCompanyType: CompanyType | null
    boardAreas: Record<string, BoardAreaLike>
    boardGraph: BoardGraphLike
    isVisibleAreaId(areaId: string): boolean
    deliveryAvailableCultivatedAreaIds: readonly string[]
}): DeliverySelectableZone[] {
    if (
        !params.enabled ||
        params.deliverySelectionStage !== 'cultivated' ||
        !params.operatingCompanyId ||
        params.operatingCompanyType !== CompanyType.Production
    ) {
        return []
    }

    const companyAreaIds = Object.values(params.boardAreas)
        .filter((area) => area.companyId === params.operatingCompanyId)
        .map((area) => area.id)
        .filter((areaId) => params.isVisibleAreaId(areaId))
        .sort(compareAreaIds)

    if (companyAreaIds.length === 0) {
        return []
    }

    const companyAreaIdSet = new Set(companyAreaIds)
    const remainingDeliverableAreaIdSet = new Set(params.deliveryAvailableCultivatedAreaIds)
    const unvisited = [...companyAreaIds]
    const zones: DeliverySelectableZone[] = []

    while (unvisited.length > 0) {
        const seedAreaId = unvisited.shift()
        if (!seedAreaId) {
            continue
        }

        const queue: string[] = [seedAreaId]
        const zoneAreaIds: string[] = []
        companyAreaIdSet.delete(seedAreaId)

        while (queue.length > 0) {
            const currentAreaId = queue.shift()
            if (!currentAreaId) {
                continue
            }

            zoneAreaIds.push(currentAreaId)
            if (!isIndonesiaNodeId(currentAreaId)) {
                continue
            }

            const currentNode = params.boardGraph.nodeById(currentAreaId)
            if (!currentNode) {
                continue
            }

            for (const neighborNode of params.boardGraph.neighborsOf(
                currentNode,
                IndonesiaNeighborDirection.Land
            )) {
                if (!companyAreaIdSet.has(neighborNode.id)) {
                    continue
                }

                companyAreaIdSet.delete(neighborNode.id)
                queue.push(neighborNode.id)
                const remainingIndex = unvisited.indexOf(neighborNode.id)
                if (remainingIndex >= 0) {
                    unvisited.splice(remainingIndex, 1)
                }
            }
        }

        zoneAreaIds.sort(compareAreaIds)
        const remainingAreaIds = zoneAreaIds.filter((areaId) =>
            remainingDeliverableAreaIdSet.has(areaId)
        )
        if (remainingAreaIds.length === 0) {
            continue
        }

        zones.push({
            key: zoneAreaIds[0] ?? `zone-${zones.length}`,
            companyId: params.operatingCompanyId,
            allAreaIds: zoneAreaIds,
            remainingAreaIds
        })
    }

    return zones.sort((left, right) => compareAreaIds(left.key, right.key))
}

export function deliverySelectableAreaIds(
    deliverySelectableZones: readonly DeliverySelectableZone[]
): string[] {
    const areaIds = new Set<string>()
    for (const zone of deliverySelectableZones) {
        for (const areaId of zone.allAreaIds) {
            areaIds.add(areaId)
        }
    }

    return [...areaIds].sort(compareAreaIds)
}

export function deliveryZoneByAreaId(
    deliverySelectableZones: readonly DeliverySelectableZone[]
): Map<string, DeliverySelectableZone> {
    const byAreaId = new Map<string, DeliverySelectableZone>()
    for (const zone of deliverySelectableZones) {
        for (const areaId of zone.allAreaIds) {
            byAreaId.set(areaId, zone)
        }
    }
    return byAreaId
}

export function deliveryZoneByKey(
    deliverySelectableZones: readonly DeliverySelectableZone[]
): Map<string, DeliverySelectableZone> {
    return new Map(deliverySelectableZones.map((zone) => [zone.key, zone]))
}

export function deriveDeliverySelectableZoneMarkers(params: {
    activeAreaInteractionAction: string | null
    deliverySelectableZones: readonly DeliverySelectableZone[]
    markerEntries: readonly ProductionMarkerLike[]
    operatingCompanyId: string | null
}): DeliverySelectableZoneMarker[] {
    if (
        params.activeAreaInteractionAction !== 'select-delivery-cultivated' ||
        params.deliverySelectableZones.length === 0 ||
        !params.operatingCompanyId ||
        params.markerEntries.length === 0
    ) {
        return []
    }

    const selectableZoneKeySet = new Set(params.deliverySelectableZones.map((zone) => zone.key))

    return params.markerEntries
        .filter((marker) => marker.companyId === params.operatingCompanyId)
        .map((marker) => {
            const zoneAreaIds = [...marker.zoneAreaIds].sort(compareAreaIds)
            const zoneKey = zoneAreaIds[0]
            if (!zoneKey || !selectableZoneKeySet.has(zoneKey)) {
                return null
            }
            return {
                key: marker.key,
                zoneKey,
                x: marker.x,
                y: marker.y
            } satisfies DeliverySelectableZoneMarker
        })
        .filter((entry): entry is DeliverySelectableZoneMarker => entry !== null)
}
