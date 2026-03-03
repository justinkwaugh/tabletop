<script lang="ts">
    import { onDestroy, onMount } from 'svelte'
    import CompanyZoneMarker from '$lib/components/CompanyZoneMarker.svelte'
    import { boardAreaPathById } from '$lib/definitions/boardGeometry.js'
    import {
        PRODUCTION_ZONE_MARKER_OFFSETS,
        PRODUCTION_ZONE_MARKER_OFFSETS_STORAGE_KEY
    } from '$lib/definitions/productionZoneMarkerOffsets.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { productionHatchVariantByCompanyId } from '$lib/utils/productionHatching.js'
    import { resolveLandMarkerPosition } from '$lib/utils/boardMarkers.js'
    import type { Point } from '@tabletop/common'
    import {
        CompanyType,
        Deeds,
        Good,
        INDONESIA_REGION_BY_AREA_ID,
        IndonesiaNeighborDirection,
        INDONESIA_REGIONS,
        isIndonesiaNodeId,
        type IndonesiaNodeId,
        type ProductionDeed
    } from '@tabletop/indonesia'

    type MarkerGood = 'spice' | 'siapsaji' | 'oil' | 'rice' | 'rubber'
    type MarkerDirection = 'north' | 'east' | 'south' | 'west'

    type PendingProductionZoneMarker = {
        key: string
        companyId: string
        regionId: string
        deedId: string
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

    type ProductionZoneMarkerEntry = {
        key: string
        companyId: string
        deedId: string
        regionId: string
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

    const BOARD_WIDTH = 2646
    const BOARD_HEIGHT = 1280
    const BOARD_CENTER: Point = { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 }
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
    const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
    const BOUNDARY_SAMPLE_SPACING = 12
    const BOUNDARY_REFINE_ITERATIONS = 8
    const PRODUCTION_ZONE_MARKER_OFFSETS_EVENT = 'indonesia-production-zone-marker-offsets-change'
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

    const regionByAreaId = INDONESIA_REGION_BY_AREA_ID as Readonly<Partial<Record<string, string>>>
    const regionCenterById = new Map<string, Point>(
        INDONESIA_REGIONS.map((region) => {
            const points = region.areaIds
                .map((areaId) => resolveLandMarkerPosition(areaId))
                .filter((point): point is Point => point !== null)
            return [region.id, averagePoint(points) ?? BOARD_CENTER] as const
        })
    )

    const gameSession = getGameSession()
    let hiddenSvgRoot: SVGSVGElement | null = null
    const boundaryPathByAreaId = new Map<string, SVGPathElement>()
    let runtimeProductionZoneMarkerOffsets: Record<string, Point> = {}

    function clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value))
    }

    function parseProductionZoneMarkerOffsets(value: unknown): Record<string, Point> {
        if (!value || typeof value !== 'object') {
            return {}
        }

        const parsed = value as Record<string, unknown>
        const nextOffsets: Record<string, Point> = {}
        for (const [deedId, candidate] of Object.entries(parsed)) {
            if (!candidate || typeof candidate !== 'object') {
                continue
            }
            const point = candidate as { x?: unknown; y?: unknown }
            if (typeof point.x !== 'number' || typeof point.y !== 'number') {
                continue
            }
            nextOffsets[deedId] = {
                x: point.x,
                y: point.y
            }
        }
        return nextOffsets
    }

    function loadRuntimeProductionZoneMarkerOffsets(): void {
        if (typeof window === 'undefined') {
            runtimeProductionZoneMarkerOffsets = {}
            return
        }

        try {
            const stored = window.localStorage.getItem(PRODUCTION_ZONE_MARKER_OFFSETS_STORAGE_KEY)
            if (!stored) {
                runtimeProductionZoneMarkerOffsets = {}
                return
            }
            runtimeProductionZoneMarkerOffsets = parseProductionZoneMarkerOffsets(JSON.parse(stored))
        } catch {
            runtimeProductionZoneMarkerOffsets = {}
        }
    }

    onMount(() => {
        if (typeof window === 'undefined') {
            return
        }

        loadRuntimeProductionZoneMarkerOffsets()

        const handleOffsetsChanged = (): void => {
            loadRuntimeProductionZoneMarkerOffsets()
        }
        const handleStorageChanged = (event: StorageEvent): void => {
            if (event.key !== PRODUCTION_ZONE_MARKER_OFFSETS_STORAGE_KEY) {
                return
            }
            loadRuntimeProductionZoneMarkerOffsets()
        }

        window.addEventListener(PRODUCTION_ZONE_MARKER_OFFSETS_EVENT, handleOffsetsChanged)
        window.addEventListener('storage', handleStorageChanged)

        return () => {
            window.removeEventListener(PRODUCTION_ZONE_MARKER_OFFSETS_EVENT, handleOffsetsChanged)
            window.removeEventListener('storage', handleStorageChanged)
        }
    })

    const productionZoneMarkerOffsetsByDeedId: Record<string, Point> = $derived.by(() => {
        return {
            ...PRODUCTION_ZONE_MARKER_OFFSETS,
            ...runtimeProductionZoneMarkerOffsets
        }
    })

    function pointDistance(a: Point, b: Point): number {
        const dx = a.x - b.x
        const dy = a.y - b.y
        return Math.hypot(dx, dy)
    }

    function ensureHiddenSvgRoot(): SVGSVGElement | null {
        if (typeof document === 'undefined') {
            return null
        }

        if (hiddenSvgRoot) {
            return hiddenSvgRoot
        }

        const root = document.createElementNS(SVG_NAMESPACE, 'svg')
        root.setAttribute('width', '0')
        root.setAttribute('height', '0')
        root.setAttribute('viewBox', '0 0 0 0')
        root.setAttribute('aria-hidden', 'true')
        root.style.position = 'absolute'
        root.style.width = '0'
        root.style.height = '0'
        root.style.opacity = '0'
        root.style.overflow = 'hidden'
        root.style.pointerEvents = 'none'
        root.style.left = '-99999px'
        root.style.top = '-99999px'
        document.body.appendChild(root)
        hiddenSvgRoot = root
        return root
    }

    function ensureBoundaryPathForArea(areaId: string): SVGPathElement | null {
        const cached = boundaryPathByAreaId.get(areaId)
        if (cached) {
            return cached
        }

        const root = ensureHiddenSvgRoot()
        if (!root) {
            return null
        }

        const areaPath = boardAreaPathById(areaId)
        if (!areaPath) {
            return null
        }

        const pathElement = document.createElementNS(SVG_NAMESPACE, 'path')
        pathElement.setAttribute('d', areaPath)
        root.appendChild(pathElement)
        boundaryPathByAreaId.set(areaId, pathElement)
        return pathElement
    }

    function nearestPointOnAreaBoundary(areaId: string, point: Point): Point | null {
        const pathElement = ensureBoundaryPathForArea(areaId)
        if (!pathElement) {
            return null
        }

        const totalLength = pathElement.getTotalLength()
        if (!Number.isFinite(totalLength) || totalLength <= 0) {
            return null
        }

        const sampleCount = Math.max(8, Math.ceil(totalLength / BOUNDARY_SAMPLE_SPACING))
        let bestLength = 0
        let bestPoint = pathElement.getPointAtLength(0)
        let bestDistance = pointDistance(point, { x: bestPoint.x, y: bestPoint.y })

        for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
            const sampleLength = (totalLength * sampleIndex) / sampleCount
            const samplePoint = pathElement.getPointAtLength(sampleLength)
            const distance = pointDistance(point, { x: samplePoint.x, y: samplePoint.y })
            if (distance < bestDistance) {
                bestDistance = distance
                bestLength = sampleLength
                bestPoint = samplePoint
            }
        }

        let leftLength = Math.max(0, bestLength - totalLength / sampleCount)
        let rightLength = Math.min(totalLength, bestLength + totalLength / sampleCount)
        for (let iteration = 0; iteration < BOUNDARY_REFINE_ITERATIONS; iteration += 1) {
            const span = rightLength - leftLength
            if (span < 0.0001) {
                break
            }

            const leftThirdLength = leftLength + span / 3
            const rightThirdLength = rightLength - span / 3
            const leftThirdPoint = pathElement.getPointAtLength(leftThirdLength)
            const rightThirdPoint = pathElement.getPointAtLength(rightThirdLength)
            const leftThirdDistance = pointDistance(point, { x: leftThirdPoint.x, y: leftThirdPoint.y })
            const rightThirdDistance = pointDistance(point, {
                x: rightThirdPoint.x,
                y: rightThirdPoint.y
            })

            if (leftThirdDistance <= rightThirdDistance) {
                rightLength = rightThirdLength
                if (leftThirdDistance < bestDistance) {
                    bestDistance = leftThirdDistance
                    bestLength = leftThirdLength
                    bestPoint = leftThirdPoint
                }
            } else {
                leftLength = leftThirdLength
                if (rightThirdDistance < bestDistance) {
                    bestDistance = rightThirdDistance
                    bestLength = rightThirdLength
                    bestPoint = rightThirdPoint
                }
            }
        }

        const refinedPoint = pathElement.getPointAtLength(bestLength)
        const refinedDistance = pointDistance(point, { x: refinedPoint.x, y: refinedPoint.y })
        if (refinedDistance < bestDistance) {
            return { x: refinedPoint.x, y: refinedPoint.y }
        }

        return { x: bestPoint.x, y: bestPoint.y }
    }

    function resolveBoundaryTargetPoint(
        markerPoint: Point,
        zoneAreaIds: readonly string[],
        fallbackTarget: Point
    ): Point {
        if (zoneAreaIds.length === 0) {
            return fallbackTarget
        }

        let nearestPoint: Point | null = null
        let nearestDistance = Number.POSITIVE_INFINITY

        const orderedAreaIds = [...zoneAreaIds].sort((leftAreaId, rightAreaId) => {
            const leftCenter = resolveLandMarkerPosition(leftAreaId)
            const rightCenter = resolveLandMarkerPosition(rightAreaId)
            const leftDistance = leftCenter ? pointDistance(markerPoint, leftCenter) : Number.POSITIVE_INFINITY
            const rightDistance = rightCenter
                ? pointDistance(markerPoint, rightCenter)
                : Number.POSITIVE_INFINITY
            if (leftDistance !== rightDistance) {
                return leftDistance - rightDistance
            }
            return leftAreaId.localeCompare(rightAreaId, undefined, { numeric: true })
        })

        for (const areaId of orderedAreaIds) {
            const boundaryPoint = nearestPointOnAreaBoundary(areaId, markerPoint)
            if (!boundaryPoint) {
                continue
            }

            const distance = pointDistance(markerPoint, boundaryPoint)
            if (distance < nearestDistance) {
                nearestDistance = distance
                nearestPoint = boundaryPoint
            }
        }

        return nearestPoint ?? fallbackTarget
    }

    function asMarkerGood(good: Good): MarkerGood {
        if (good === Good.Rice) {
            return 'rice'
        }
        if (good === Good.Spice) {
            return 'spice'
        }
        if (good === Good.Rubber) {
            return 'rubber'
        }
        if (good === Good.Oil) {
            return 'oil'
        }
        return 'siapsaji'
    }

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

    function buildCompanyCultivatedZones(companyId: string): CompanyCultivatedZone[] {
        const cultivatedAreaIdSet = new Set<IndonesiaNodeId>()
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('companyId' in area) || area.companyId !== companyId) {
                continue
            }
            if (!isIndonesiaNodeId(area.id)) {
                continue
            }
            cultivatedAreaIdSet.add(area.id)
        }

        const unvisited = [...cultivatedAreaIdSet].sort((left, right) =>
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
                const currentNode = gameSession.gameState.board.graph.nodeById(currentAreaId)
                if (!currentNode) {
                    continue
                }

                for (const neighborNode of gameSession.gameState.board.graph.neighborsOf(
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

        return sortedZoneAreaGroups.map((areaIds) => {
            const zonePoints = areaIds
                .map((areaId) => resolveLandMarkerPosition(areaId))
                .filter((point): point is Point => point !== null)
            return {
                areaIds,
                size: areaIds.length,
                center: averagePoint(zonePoints)
            }
        })
    }

    function directionTowardTarget(
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

        if (ENABLE_NS_MARKER_DIRECTIONS || cardinalDirection === 'east' || cardinalDirection === 'west') {
            return cardinalDirection
        }

        return deltaX >= 0 ? 'east' : 'west'
    }

    const productionZoneMarkers: ProductionZoneMarkerEntry[] = $derived.by(() => {
        const companyById = new Map(
            gameSession.gameState.companies.map((company) => [company.id, company] as const)
        )
        const hatchVariantByCompanyId = productionHatchVariantByCompanyId(
            gameSession.gameState,
            HATCH_PATTERN_IDS.length
        )

        const regionFallbackCenterById = new Map<string, Point>()
        const pendingMarkers: PendingProductionZoneMarker[] = []
        const deliveredAreaIdSetByCompanyId = new Map<string, Set<string>>()
        for (const [companyId, deliveredAreaIds] of Object.entries(
            gameSession.gameState.operationsDeliveredCultivatedAreaIdsByCompanyId ?? {}
        )) {
            deliveredAreaIdSetByCompanyId.set(companyId, new Set(deliveredAreaIds))
        }
        for (const company of gameSession.gameState.companies) {
            if (company.type !== CompanyType.Production) {
                continue
            }

            const productionDeeds = company.deeds.filter(
                (deed): deed is ProductionDeed => deed.type === CompanyType.Production
            )
            if (productionDeeds.length === 0) {
                continue
            }

            const ownerColor = gameSession.colors.getPlayerUiColor(company.owner)
            const markerGood = asMarkerGood(company.good)
            const hatchVariant = hatchVariantByCompanyId.get(company.id)
            const hatchPatternId =
                hatchVariant === undefined ? null : HATCH_PATTERN_IDS[hatchVariant]
            const companyZones = buildCompanyCultivatedZones(company.id)
            for (const [deedIndex, deed] of productionDeeds.entries()) {
                const matchingZones = companyZones
                    .map((zone) => {
                        const areaIdsInRegion = zone.areaIds.filter(
                            (areaId) => regionByAreaId[areaId] === deed.region
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
                const selectedZoneRegionPoints = selectedZone
                    .areaIdsInRegion
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
                    ownerColor,
                    goodType: markerGood,
                    goodsCount:
                        selectedZone.zone.areaIds.filter(
                            (areaId) =>
                                !(
                                    deliveredAreaIdSetByCompanyId.get(company.id)?.has(areaId) ??
                                    false
                                )
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
                const centeredIndex =
                    slot !== undefined
                        ? slot.index - (slot.count - 1) / 2
                        : 0
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
                    BASE_OFFSET_DISTANCE + Math.floor(Math.abs(centeredIndex)) * RADIAL_STEP_DISTANCE
                const lateralDistance = centeredIndex * LATERAL_SPREAD_DISTANCE
                const baseMarkerX = clamp(
                    centroidTargetX + directionX * radialDistance + tangentX * lateralDistance,
                    EDGE_PADDING,
                    BOARD_WIDTH - EDGE_PADDING
                )
                const baseMarkerY = clamp(
                    centroidTargetY + directionY * radialDistance + tangentY * lateralDistance,
                    EDGE_PADDING,
                    BOARD_HEIGHT - EDGE_PADDING
                )
                const deedOffset = productionZoneMarkerOffsetsByDeedId[marker.deedId] ?? { x: 0, y: 0 }
                const markerX = clamp(baseMarkerX + deedOffset.x, EDGE_PADDING, BOARD_WIDTH - EDGE_PADDING)
                const markerY = clamp(baseMarkerY + deedOffset.y, EDGE_PADDING, BOARD_HEIGHT - EDGE_PADDING)
                const wireTarget = resolveBoundaryTargetPoint(
                    { x: markerX, y: markerY },
                    marker.zoneAreaIds,
                    marker.zoneTarget
                )

                markerEntries.push({
                    key: `${regionId}|${marker.key}`,
                    companyId: marker.companyId,
                    deedId: marker.deedId,
                    regionId,
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
                    direction: directionTowardTarget(markerX, markerY, wireTarget.x, wireTarget.y)
                })
            }
        }

        return markerEntries
    })

    const hoveredProductionCompanyId: string | null = $derived.by(() => {
        const hoveredCompanyId = gameSession.hoveredOperatingCompanyId
        if (!hoveredCompanyId) {
            return null
        }
        const hoveredCompany = gameSession.gameState.companies.find(
            (company) => company.id === hoveredCompanyId
        )
        if (!hoveredCompany || hoveredCompany.type !== CompanyType.Production) {
            return null
        }
        return hoveredCompany.id
    })

    const spotlightedProductionCompanyIdSet: ReadonlySet<string> = $derived.by(() => {
        const productionCompanyIds = new Set<string>()

        for (const companyId of gameSession.hoveredCompanySpotlightCompanyIds) {
            const company = gameSession.gameState.companies.find((entry) => entry.id === companyId)
            if (!company || company.type !== CompanyType.Production) {
                continue
            }
            productionCompanyIds.add(company.id)
        }

        if (productionCompanyIds.size === 0 && hoveredProductionCompanyId) {
            productionCompanyIds.add(hoveredProductionCompanyId)
        }

        return productionCompanyIds
    })

    const baseProductionZoneMarkers: ProductionZoneMarkerEntry[] = $derived.by(() => {
        if (spotlightedProductionCompanyIdSet.size === 0) {
            return productionZoneMarkers
        }
        return productionZoneMarkers.filter(
            (marker) => !spotlightedProductionCompanyIdSet.has(marker.companyId)
        )
    })

    const highlightedProductionZoneMarkers: ProductionZoneMarkerEntry[] = $derived.by(() => {
        if (spotlightedProductionCompanyIdSet.size === 0) {
            return []
        }
        return productionZoneMarkers.filter((marker) =>
            spotlightedProductionCompanyIdSet.has(marker.companyId)
        )
    })

    const maskNonSelectableZoneTagsDuringDeliverySelection: boolean = $derived.by(() => {
        return (
            gameSession.deliverySelectionEnabled &&
            gameSession.deliverySelectionStage === 'cultivated'
        )
    })

    const maskAllZoneTagsDuringDeliveryCitySelection: boolean = $derived.by(() => {
        return gameSession.deliverySelectionEnabled && gameSession.deliverySelectionStage === 'city'
    })

    const selectableDeliveryZoneMarkerKeySet: ReadonlySet<string> = $derived.by(() => {
        if (!maskNonSelectableZoneTagsDuringDeliverySelection) {
            return new Set<string>()
        }

        const operatingCompanyId = gameSession.gameState.operatingCompanyId
        if (!operatingCompanyId) {
            return new Set<string>()
        }

        const remainingCultivatedAreaIdSet = new Set(gameSession.deliveryAvailableCultivatedAreaIds)
        if (remainingCultivatedAreaIdSet.size === 0) {
            return new Set<string>()
        }

        return new Set(
            productionZoneMarkers
                .filter(
                    (marker) =>
                        marker.companyId === operatingCompanyId &&
                        marker.zoneAreaIds.some((areaId) => remainingCultivatedAreaIdSet.has(areaId))
                )
                .map((marker) => marker.key)
        )
    })

    const maskNonSpotlightZoneTagsDuringCompanyHover: boolean = $derived.by(() => {
        return spotlightedProductionCompanyIdSet.size > 0
    })

    const maskAllZoneTagsDuringNonProductionCompanyHover: boolean = $derived.by(() => {
        const hasAnyCompanySpotlight =
            gameSession.hoveredOperatingCompanyId !== null ||
            gameSession.hoveredCompanySpotlightCompanyIds.length > 0
        return hasAnyCompanySpotlight && spotlightedProductionCompanyIdSet.size === 0
    })

    function isMarkerMasked(marker: ProductionZoneMarkerEntry): boolean {
        if (maskAllZoneTagsDuringDeliveryCitySelection) {
            return true
        }
        if (
            maskNonSelectableZoneTagsDuringDeliverySelection &&
            !selectableDeliveryZoneMarkerKeySet.has(marker.key)
        ) {
            return true
        }
        if (
            maskNonSpotlightZoneTagsDuringCompanyHover &&
            !spotlightedProductionCompanyIdSet.has(marker.companyId)
        ) {
            return true
        }
        if (maskAllZoneTagsDuringNonProductionCompanyHover) {
            return true
        }
        return false
    }

    $effect(() => {
        if (typeof window === 'undefined') {
            return
        }
        ;(
            window as Window & {
                __indonesiaProductionZoneMarkerEntries?: ProductionZoneMarkerEntry[]
            }
        ).__indonesiaProductionZoneMarkerEntries = productionZoneMarkers
    })

    onDestroy(() => {
        if (typeof window === 'undefined') {
            return
        }
        delete (
            window as Window & {
                __indonesiaProductionZoneMarkerEntries?: ProductionZoneMarkerEntry[]
            }
        ).__indonesiaProductionZoneMarkerEntries
    })
</script>

<g class="pointer-events-none select-none" aria-label="Production zone markers layer">
    {#each baseProductionZoneMarkers as marker (marker.key)}
        <CompanyZoneMarker
            x={marker.x}
            y={marker.y}
            targetX={marker.targetX}
            targetY={marker.targetY}
            playerColor={marker.ownerColor}
            goodType={marker.goodType}
            goodsCount={marker.goodsCount}
            hatchPatternId={marker.hatchPatternId}
            direction={marker.direction}
            highlighted={false}
            masked={isMarkerMasked(marker)}
        />
    {/each}

    {#if highlightedProductionZoneMarkers.length > 0}
        {#each highlightedProductionZoneMarkers as marker (marker.key)}
            <CompanyZoneMarker
                x={marker.x}
                y={marker.y}
                targetX={marker.targetX}
                targetY={marker.targetY}
                playerColor={marker.ownerColor}
                goodType={marker.goodType}
                goodsCount={marker.goodsCount}
                hatchPatternId={marker.hatchPatternId}
                direction={marker.direction}
                highlighted={true}
                masked={isMarkerMasked(marker)}
            />
        {/each}
    {/if}
</g>
