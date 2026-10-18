import type { Point } from '@tabletop/common'
import {
    CompanyType,
    Deeds,
    INDONESIA_REGION_BY_AREA_ID,
    IndonesiaNeighborDirection,
    INDONESIA_REGIONS,
    isIndonesiaNodeId,
    type IndonesiaNodeId,
    type ProductionDeed
} from '@tabletop/indonesia'
import { BOARD_CENTER, BOARD_HEIGHT, BOARD_WIDTH } from '$lib/definitions/boardSize.js'
import {
    MARKER_GOOD_BY_GOOD,
    type MarkerDirection,
    type MarkerGood
} from '$lib/definitions/productionMarkers.js'
import { PRODUCTION_ZONE_MARKER_OFFSETS } from '$lib/definitions/productionZoneMarkerOffsets.js'
import { resolveLandMarkerPosition } from '$lib/utils/boardMarkers.js'
import { productionHatchVariantByCompanyId } from '$lib/utils/productionHatching.js'
import { resolveProductionZoneBoundaryTarget } from '$lib/utils/productionZoneMarkerBoundary.js'
import type { IndonesiaGameSession } from './session.svelte.js'

type PendingProductionZoneMarker = {
    key: string
    companyId: string
    regionId: string
    deedId: string
    areaIdsInRegionCount: number
    ownerColor: string
    goodType: MarkerGood
    goodsCount: number
    hatchPatternId: string | null
    zoneAreaIds: readonly string[]
    anchor: Point
    zoneTarget: Point
}

type CompanyCultivatedZone = {
    areaIds: IndonesiaNodeId[]
    size: number
    center: Point | null
}

export type ProductionZoneMarkerEntry = {
    key: string
    companyId: string
    deedId: string
    regionId: string
    areaIdsInRegionCount: number
    x: number
    y: number
    baseX: number
    baseY: number
    targetX: number
    targetY: number
    ownerColor: string
    goodType: MarkerGood
    goodsCount: number
    zoneAreaIds: readonly string[]
    hatchPatternId: string | null
    direction: MarkerDirection
}

const EDGE_PADDING = 68
const BASE_OFFSET_DISTANCE = 100
const RADIAL_STEP_DISTANCE = 18
const LATERAL_SPREAD_DISTANCE = 62
const HATCH_PATTERN_IDS = [
    'cultivated-hatch-diag-0',
    'cultivated-hatch-diag-1',
    'cultivated-hatch-diag-2',
    'cultivated-hatch-diag-3'
] as const
const MAX_COMPANY_ZONE_CACHE_ENTRIES = 1200
const ENABLE_NS_MARKER_DIRECTIONS = false

const productionDeedSlotById = (() => {
    const slotById = new Map<string, { index: number; count: number }>()
    const productionDeeds = Deeds.filter(
        (deed): deed is ProductionDeed => deed.type === CompanyType.Production
    ).sort((left, right) => {
        if (left.region !== right.region) {
            return left.region.localeCompare(right.region, undefined, { numeric: true })
        }
        return left.id.localeCompare(right.id, undefined, { numeric: true })
    })

    const deedIdsByRegion = new Map<string, string[]>()
    for (const deed of productionDeeds) {
        const deedIds = deedIdsByRegion.get(deed.region) ?? []
        deedIds.push(deed.id)
        deedIdsByRegion.set(deed.region, deedIds)
    }

    for (const deedIds of deedIdsByRegion.values()) {
        const count = deedIds.length
        for (const [index, deedId] of deedIds.entries()) {
            slotById.set(deedId, { index, count })
        }
    }

    return slotById
})()

const regionCenterById = new Map<string, Point>(
    INDONESIA_REGIONS.map((region) => {
        const points = region.areaIds
            .map((areaId) => resolveLandMarkerPosition(areaId))
            .filter((point): point is Point => point !== null)
        return [region.id, averagePoint(points) ?? BOARD_CENTER] as const
    })
)

function averagePoint(points: readonly Point[]): Point | null {
    if (points.length === 0) {
        return null
    }

    let x = 0
    let y = 0
    for (const point of points) {
        x += point.x
        y += point.y
    }

    return {
        x: x / points.length,
        y: y / points.length
    }
}

export class ProductionZoneMarkers {
    developerOffsets: Record<string, Point> = $state({})
    readonly entries: ProductionZoneMarkerEntry[] = $derived.by(() => this.deriveEntries())

    private readonly gameSession: IndonesiaGameSession
    private readonly zoneCache = new Map<string, CompanyCultivatedZone[]>()

    constructor(gameSession: IndonesiaGameSession) {
        this.gameSession = gameSession
    }

    private deriveEntries(): ProductionZoneMarkerEntry[] {
        const offsetsByDeedId: Record<string, Point> = {
            ...PRODUCTION_ZONE_MARKER_OFFSETS,
            ...this.developerOffsets
        }

        const cultivatedAreaIdsByCompanyId = new Map<string, IndonesiaNodeId[]>()
        for (const area of Object.values(this.gameSession.gameState.board.areas)) {
            if (!('companyId' in area) || !area.companyId || !isIndonesiaNodeId(area.id)) {
                continue
            }
            const companyAreaIds = cultivatedAreaIdsByCompanyId.get(area.companyId) ?? []
            companyAreaIds.push(area.id)
            cultivatedAreaIdsByCompanyId.set(area.companyId, companyAreaIds)
        }
        for (const areaIds of cultivatedAreaIdsByCompanyId.values()) {
            areaIds.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
        }

        const hatchVariantByCompanyId = productionHatchVariantByCompanyId(
            this.gameSession.gameState,
            HATCH_PATTERN_IDS.length
        )

        const regionFallbackCenterById = new Map<string, Point>()
        const pendingMarkers: PendingProductionZoneMarker[] = []
        const deliveredAreaIdSetByCompanyId = new Map<string, Set<string>>()
        for (const [companyId, deliveredAreaIds] of Object.entries(
            this.gameSession.gameState.operationsDeliveredCultivatedAreaIdsByCompanyId ?? {}
        )) {
            deliveredAreaIdSetByCompanyId.set(companyId, new Set(deliveredAreaIds))
        }
        for (const company of this.gameSession.gameState.companies) {
            if (company.type !== CompanyType.Production) {
                continue
            }

            const productionDeeds = company.deeds.filter(
                (deed): deed is ProductionDeed => deed.type === CompanyType.Production
            )
            if (productionDeeds.length === 0) {
                continue
            }

            const ownerColor = this.gameSession.colors.getPlayerUiColor(company.owner)
            const markerGood = MARKER_GOOD_BY_GOOD[company.good]
            const hatchVariant = hatchVariantByCompanyId.get(company.id)
            const hatchPatternId =
                hatchVariant === undefined ? null : HATCH_PATTERN_IDS[hatchVariant]
            const companyZones = this.buildCompanyCultivatedZones(
                company.id,
                cultivatedAreaIdsByCompanyId
            )
            for (const [deedIndex, deed] of productionDeeds.entries()) {
                const matchingZones = companyZones
                    .map((zone) => {
                        const areaIdsInRegion = zone.areaIds.filter(
                            (areaId) => INDONESIA_REGION_BY_AREA_ID[areaId] === deed.region
                        )
                        return {
                            zone,
                            areaIdsInRegion
                        }
                    })
                    .filter(({ areaIdsInRegion }) => areaIdsInRegion.length > 0)
                    .sort((left, right) => {
                        if (left.areaIdsInRegion.length !== right.areaIdsInRegion.length) {
                            return right.areaIdsInRegion.length - left.areaIdsInRegion.length
                        }
                        if (left.zone.size !== right.zone.size) {
                            return right.zone.size - left.zone.size
                        }
                        return (left.zone.areaIds[0] ?? '').localeCompare(
                            right.zone.areaIds[0] ?? '',
                            undefined,
                            { numeric: true }
                        )
                    })

                const selectedZone = matchingZones[0] ?? null
                if (!selectedZone) {
                    // Keep the deed in company state, but do not render a map tag when this deed
                    // currently has no cultivated areas in its region.
                    continue
                }
                const selectedZoneRegionPoints = selectedZone.areaIdsInRegion
                    .map((areaId) => resolveLandMarkerPosition(areaId))
                    .filter((point): point is Point => point !== null)
                let targetPoint = averagePoint(selectedZoneRegionPoints)

                if (!targetPoint) {
                    targetPoint = selectedZone.zone.center ?? null
                }

                if (!targetPoint) {
                    targetPoint = regionFallbackCenterById.get(deed.region) ?? null
                }

                if (!targetPoint) {
                    const region = INDONESIA_REGIONS.find(
                        (candidateRegion) => candidateRegion.id === deed.region
                    )
                    if (region) {
                        const regionAnchorPoints = region.areaIds
                            .map((areaId) => resolveLandMarkerPosition(areaId))
                            .filter((point): point is Point => point !== null)
                        targetPoint = averagePoint(regionAnchorPoints)
                        if (targetPoint) {
                            regionFallbackCenterById.set(deed.region, targetPoint)
                        }
                    }
                }

                if (!targetPoint) {
                    continue
                }

                const anchorPoint = regionCenterById.get(deed.region) ?? targetPoint

                pendingMarkers.push({
                    key: `${company.id}|${deed.id}|${deedIndex}`,
                    companyId: company.id,
                    regionId: deed.region,
                    deedId: deed.id,
                    areaIdsInRegionCount: selectedZone.areaIdsInRegion.length,
                    ownerColor,
                    goodType: markerGood,
                    goodsCount: selectedZone.zone.areaIds.filter(
                        (areaId) =>
                            !(deliveredAreaIdSetByCompanyId.get(company.id)?.has(areaId) ?? false)
                    ).length,
                    hatchPatternId,
                    zoneAreaIds: selectedZone.zone.areaIds,
                    anchor: anchorPoint,
                    zoneTarget: targetPoint
                })
            }
        }

        const pendingMarkersByRegion = new Map<string, PendingProductionZoneMarker[]>()
        for (const marker of pendingMarkers) {
            const markersForRegion = pendingMarkersByRegion.get(marker.regionId) ?? []
            markersForRegion.push(marker)
            pendingMarkersByRegion.set(marker.regionId, markersForRegion)
        }

        const markerEntries: ProductionZoneMarkerEntry[] = []
        for (const [regionId, markersForRegion] of pendingMarkersByRegion.entries()) {
            const orderedMarkers = [...markersForRegion].sort((left, right) =>
                left.key.localeCompare(right.key)
            )
            for (const marker of orderedMarkers) {
                const slot = productionDeedSlotById.get(marker.deedId)
                const centeredIndex = slot !== undefined ? slot.index - (slot.count - 1) / 2 : 0
                const centroidTargetX = marker.anchor.x
                const centroidTargetY = marker.anchor.y

                let directionX = centroidTargetX - BOARD_CENTER.x
                let directionY = centroidTargetY - BOARD_CENTER.y
                const directionMagnitude = Math.hypot(directionX, directionY)
                if (directionMagnitude > 0.001) {
                    directionX /= directionMagnitude
                    directionY /= directionMagnitude
                } else {
                    directionX = 0
                    directionY = -1
                }

                const tangentX = -directionY
                const tangentY = directionX

                const radialDistance =
                    BASE_OFFSET_DISTANCE +
                    Math.floor(Math.abs(centeredIndex)) * RADIAL_STEP_DISTANCE
                const lateralDistance = centeredIndex * LATERAL_SPREAD_DISTANCE
                const baseMarkerX = this.clamp(
                    centroidTargetX + directionX * radialDistance + tangentX * lateralDistance,
                    EDGE_PADDING,
                    BOARD_WIDTH - EDGE_PADDING
                )
                const baseMarkerY = this.clamp(
                    centroidTargetY + directionY * radialDistance + tangentY * lateralDistance,
                    EDGE_PADDING,
                    BOARD_HEIGHT - EDGE_PADDING
                )
                const deedOffset = offsetsByDeedId[marker.deedId] ?? { x: 0, y: 0 }
                const markerX = this.clamp(
                    baseMarkerX + deedOffset.x,
                    EDGE_PADDING,
                    BOARD_WIDTH - EDGE_PADDING
                )
                const markerY = this.clamp(
                    baseMarkerY + deedOffset.y,
                    EDGE_PADDING,
                    BOARD_HEIGHT - EDGE_PADDING
                )
                const wireTarget = resolveProductionZoneBoundaryTarget(
                    { x: markerX, y: markerY },
                    marker.zoneAreaIds,
                    marker.zoneTarget
                )

                markerEntries.push({
                    key: `${regionId}|${marker.key}`,
                    companyId: marker.companyId,
                    deedId: marker.deedId,
                    regionId,
                    areaIdsInRegionCount: marker.areaIdsInRegionCount,
                    x: markerX,
                    y: markerY,
                    baseX: baseMarkerX,
                    baseY: baseMarkerY,
                    targetX: wireTarget.x,
                    targetY: wireTarget.y,
                    ownerColor: marker.ownerColor,
                    goodType: marker.goodType,
                    goodsCount: marker.goodsCount,
                    zoneAreaIds: marker.zoneAreaIds,
                    hatchPatternId: marker.hatchPatternId,
                    direction: this.directionTowardTarget(
                        markerX,
                        markerY,
                        wireTarget.x,
                        wireTarget.y
                    )
                })
            }
        }

        const uniqueMarkerEntriesByZoneKey = new Map<string, ProductionZoneMarkerEntry>()
        for (const marker of markerEntries) {
            const zoneKey = `${marker.companyId}|${marker.zoneAreaIds.join(',')}`
            const existing = uniqueMarkerEntriesByZoneKey.get(zoneKey)
            if (!existing) {
                uniqueMarkerEntriesByZoneKey.set(zoneKey, marker)
                continue
            }

            if (marker.areaIdsInRegionCount > existing.areaIdsInRegionCount) {
                uniqueMarkerEntriesByZoneKey.set(zoneKey, marker)
                continue
            }

            if (marker.areaIdsInRegionCount < existing.areaIdsInRegionCount) {
                continue
            }

            if (marker.key.localeCompare(existing.key, undefined, { numeric: true }) < 0) {
                uniqueMarkerEntriesByZoneKey.set(zoneKey, marker)
            }
        }

        return [...uniqueMarkerEntriesByZoneKey.values()]
    }

    private buildCompanyCultivatedZones(
        companyId: string,
        cultivatedAreaIdsByCompanyId: ReadonlyMap<string, readonly IndonesiaNodeId[]>
    ): CompanyCultivatedZone[] {
        const cultivatedAreaIds = cultivatedAreaIdsByCompanyId.get(companyId) ?? []
        if (cultivatedAreaIds.length === 0) {
            return []
        }
        const cacheKey = `${companyId}|${cultivatedAreaIds.join(',')}`
        const cachedZones = this.zoneCache.get(cacheKey)
        if (cachedZones) {
            return cachedZones
        }

        const unvisited = [...cultivatedAreaIds].sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true })
        )
        const zoneAreaIdGroups: IndonesiaNodeId[][] = []

        while (unvisited.length > 0) {
            const seedAreaId = unvisited.shift()
            if (!seedAreaId) {
                continue
            }

            const queue: IndonesiaNodeId[] = [seedAreaId]
            const zoneAreaIds: IndonesiaNodeId[] = []
            const remaining = new Set(unvisited)
            remaining.delete(seedAreaId)

            while (queue.length > 0) {
                const currentAreaId = queue.shift()
                if (!currentAreaId) {
                    continue
                }

                zoneAreaIds.push(currentAreaId)
                const currentNode = this.gameSession.gameState.board.graph.nodeById(currentAreaId)
                if (!currentNode) {
                    continue
                }

                for (const neighborNode of this.gameSession.gameState.board.graph.neighborsOf(
                    currentNode,
                    IndonesiaNeighborDirection.Land
                )) {
                    if (!remaining.has(neighborNode.id)) {
                        continue
                    }

                    remaining.delete(neighborNode.id)
                    queue.push(neighborNode.id)
                }
            }

            const sortedRemaining = [...remaining].sort((left, right) =>
                left.localeCompare(right, undefined, { numeric: true })
            )
            unvisited.splice(0, unvisited.length, ...sortedRemaining)
            zoneAreaIdGroups.push(
                zoneAreaIds.sort((left, right) =>
                    left.localeCompare(right, undefined, { numeric: true })
                )
            )
        }

        const sortedZoneAreaGroups = [...zoneAreaIdGroups].sort((groupA, groupB) =>
            (groupA[0] ?? '').localeCompare(groupB[0] ?? '', undefined, { numeric: true })
        )

        const zones = sortedZoneAreaGroups.map((areaIds) => {
            const zonePoints = areaIds
                .map((areaId) => resolveLandMarkerPosition(areaId))
                .filter((point): point is Point => point !== null)
            return {
                areaIds,
                size: areaIds.length,
                center: averagePoint(zonePoints)
            }
        })
        this.rememberZones(cacheKey, zones)
        return zones
    }

    private directionTowardTarget(
        markerX: number,
        markerY: number,
        targetX: number,
        targetY: number
    ): MarkerDirection {
        const deltaX = targetX - markerX
        const deltaY = targetY - markerY
        const cardinalDirection: MarkerDirection =
            Math.abs(deltaX) >= Math.abs(deltaY)
                ? deltaX >= 0
                    ? 'east'
                    : 'west'
                : deltaY >= 0
                  ? 'south'
                  : 'north'

        if (
            ENABLE_NS_MARKER_DIRECTIONS ||
            cardinalDirection === 'east' ||
            cardinalDirection === 'west'
        ) {
            return cardinalDirection
        }

        return deltaX >= 0 ? 'east' : 'west'
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value))
    }

    private rememberZones(cacheKey: string, zones: CompanyCultivatedZone[]): void {
        this.zoneCache.set(cacheKey, zones)
        if (this.zoneCache.size > MAX_COMPANY_ZONE_CACHE_ENTRIES) {
            const oldest = this.zoneCache.keys().next()
            if (!oldest.done) {
                this.zoneCache.delete(oldest.value)
            }
        }
    }
}
