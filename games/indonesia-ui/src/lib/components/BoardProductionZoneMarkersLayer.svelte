<script lang="ts">
    import { onDestroy, onMount } from 'svelte'
    import { animateStartedProductionMarker } from '$lib/animators/startCompanyAnimator.js'
    import CompanyZoneMarker from '$lib/components/CompanyZoneMarker.svelte'
    import {
        PRODUCTION_ZONE_MARKER_OFFSETS,
        PRODUCTION_ZONE_MARKER_OFFSETS_STORAGE_KEY
    } from '$lib/definitions/productionZoneMarkerOffsets.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { getStartCompanyAnimatorContext } from '$lib/model/startCompanyAnimatorContext.svelte.js'
    import { resolveProductionZoneBoundaryTarget } from '$lib/utils/productionZoneMarkerBoundary.js'
    import { startedProductionZoneMarkerEntryForAction } from '$lib/utils/startedCompanyEntries.js'
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
        MachineState,
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

    type ProductionZoneMarkerEntry = {
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

    type UiPerfAggregate = {
        count: number
        totalMs: number
        maxMs: number
        lastMs: number
        lastMeta?: Record<string, number>
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
    const MAX_COMPANY_ZONE_CACHE_ENTRIES = 1200
    const PRODUCTION_ZONE_MARKER_OFFSETS_EVENT = 'indonesia-production-zone-marker-offsets-change'
    const ENABLE_NS_MARKER_DIRECTIONS = false
    const HOVER_COMPANY_ZONE_TAG_MASK_OPACITY = 0.26
    const SELECTION_ZONE_TAG_MASK_OPACITY = 0.42
    const OPERATED_ZONE_TAG_MASK_OPACITY = 0.34
    const UI_PERF_STORAGE_KEY = 'indonesia-ui-perf'
    const UI_PERF_GLOBAL_KEY = '__indonesiaUiPerf'

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
    const startCompanyAnimator = getStartCompanyAnimatorContext()
    const companyCultivatedZoneCache = new Map<string, CompanyCultivatedZone[]>()
    let runtimeProductionZoneMarkerOffsets: Record<string, Point> = {}
    let uiPerfEnabled = false

    function clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value))
    }

    function setBoundedMapValue<K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number): void {
        map.set(key, value)
        if (map.size > maxEntries) {
            const oldestKey = map.keys().next().value as K | undefined
            if (oldestKey !== undefined) {
                map.delete(oldestKey)
            }
        }
    }

    function readUiPerfEnabledFromEnvironment(): boolean {
        if (typeof window === 'undefined') {
            return false
        }
        const globalEnabled = (window as Window & { __indonesiaUiPerfEnabled?: unknown })
            .__indonesiaUiPerfEnabled
        if (globalEnabled === true) {
            return true
        }
        return window.localStorage.getItem(UI_PERF_STORAGE_KEY) === '1'
    }

    function recordUiPerfSample(
        label: string,
        durationMs: number,
        meta?: Record<string, number>
    ): void {
        if (!uiPerfEnabled || typeof window === 'undefined') {
            return
        }

        const perfWindow = window as Window & {
            [UI_PERF_GLOBAL_KEY]?: {
                aggregates: Record<string, UiPerfAggregate>
                lastSamples: Array<{
                    label: string
                    durationMs: number
                    meta?: Record<string, number>
                    at: number
                }>
            }
        }
        const existingState = perfWindow[UI_PERF_GLOBAL_KEY] ?? {
            aggregates: {},
            lastSamples: []
        }
        const existingAggregate = existingState.aggregates[label]
        const nextAggregate: UiPerfAggregate = existingAggregate
            ? {
                  count: existingAggregate.count + 1,
                  totalMs: existingAggregate.totalMs + durationMs,
                  maxMs: Math.max(existingAggregate.maxMs, durationMs),
                  lastMs: durationMs,
                  lastMeta: meta
              }
            : {
                  count: 1,
                  totalMs: durationMs,
                  maxMs: durationMs,
                  lastMs: durationMs,
                  lastMeta: meta
              }
        existingState.aggregates[label] = nextAggregate
        existingState.lastSamples.push({
            label,
            durationMs,
            meta,
            at: Date.now()
        })
        if (existingState.lastSamples.length > 200) {
            existingState.lastSamples.splice(0, existingState.lastSamples.length - 200)
        }
        perfWindow[UI_PERF_GLOBAL_KEY] = existingState

        if (durationMs >= 8 || nextAggregate.count % 40 === 0) {
            console.info(`[ui-perf] ${label}: ${durationMs.toFixed(2)}ms`, {
                ...meta,
                avgMs: nextAggregate.totalMs / nextAggregate.count,
                maxMs: nextAggregate.maxMs,
                count: nextAggregate.count
            })
        }
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
        uiPerfEnabled = readUiPerfEnabledFromEnvironment()

        const handleOffsetsChanged = (): void => {
            loadRuntimeProductionZoneMarkerOffsets()
        }
        const handleStorageChanged = (event: StorageEvent): void => {
            if (event.key === PRODUCTION_ZONE_MARKER_OFFSETS_STORAGE_KEY) {
                loadRuntimeProductionZoneMarkerOffsets()
            } else if (event.key === UI_PERF_STORAGE_KEY) {
                uiPerfEnabled = readUiPerfEnabledFromEnvironment()
            }
        }

        const perfWindow = window as Window & {
            __setIndonesiaUiPerf?: (enabled: boolean) => void
        }
        perfWindow.__setIndonesiaUiPerf = (enabled: boolean) => {
            uiPerfEnabled = enabled
            if (enabled) {
                window.localStorage.setItem(UI_PERF_STORAGE_KEY, '1')
            } else {
                window.localStorage.removeItem(UI_PERF_STORAGE_KEY)
            }
        }

        window.addEventListener(PRODUCTION_ZONE_MARKER_OFFSETS_EVENT, handleOffsetsChanged)
        window.addEventListener('storage', handleStorageChanged)

        return () => {
            window.removeEventListener(PRODUCTION_ZONE_MARKER_OFFSETS_EVENT, handleOffsetsChanged)
            window.removeEventListener('storage', handleStorageChanged)
            delete perfWindow.__setIndonesiaUiPerf
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

    function buildCompanyCultivatedZones(
        companyId: string,
        cultivatedAreaIdsByCompanyId: ReadonlyMap<string, readonly IndonesiaNodeId[]>
    ): CompanyCultivatedZone[] {
        const cultivatedAreaIds = cultivatedAreaIdsByCompanyId.get(companyId) ?? []
        if (cultivatedAreaIds.length === 0) {
            return []
        }
        const cacheKey = `${companyId}|${cultivatedAreaIds.join(',')}`
        const cachedZones = companyCultivatedZoneCache.get(cacheKey)
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
        setBoundedMapValue(
            companyCultivatedZoneCache,
            cacheKey,
            zones,
            MAX_COMPANY_ZONE_CACHE_ENTRIES
        )
        return zones
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
        const computationStartAt = uiPerfEnabled ? performance.now() : 0
        let zoneBuildMs = 0
        let boundaryResolveMs = 0

        const cultivatedAreaIdsByCompanyId = new Map<string, IndonesiaNodeId[]>()
        for (const area of Object.values(gameSession.gameState.board.areas)) {
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
            const zoneBuildStartAt = uiPerfEnabled ? performance.now() : 0
            const companyZones = buildCompanyCultivatedZones(company.id, cultivatedAreaIdsByCompanyId)
            if (uiPerfEnabled) {
                zoneBuildMs += performance.now() - zoneBuildStartAt
            }
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
                const boundaryResolveStartAt = uiPerfEnabled ? performance.now() : 0
                const wireTarget = resolveProductionZoneBoundaryTarget(
                    { x: markerX, y: markerY },
                    marker.zoneAreaIds,
                    marker.zoneTarget
                )
                if (uiPerfEnabled) {
                    boundaryResolveMs += performance.now() - boundaryResolveStartAt
                }

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
                    direction: directionTowardTarget(markerX, markerY, wireTarget.x, wireTarget.y)
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

            if (
                marker.key.localeCompare(existing.key, undefined, { numeric: true }) < 0
            ) {
                uniqueMarkerEntriesByZoneKey.set(zoneKey, marker)
            }
        }

        const deduplicatedMarkerEntries = [...uniqueMarkerEntriesByZoneKey.values()]

        if (uiPerfEnabled) {
            recordUiPerfSample(
                'board:production-zone-markers:derive',
                performance.now() - computationStartAt,
                {
                    actionCount: gameSession.gameState.actionCount,
                    markerCount: deduplicatedMarkerEntries.length,
                    pendingCount: pendingMarkers.length,
                    zoneBuildMs: Math.round(zoneBuildMs * 100) / 100,
                    boundaryResolveMs: Math.round(boundaryResolveMs * 100) / 100,
                    companyZoneCacheSize: companyCultivatedZoneCache.size
                }
            )
        }

        return deduplicatedMarkerEntries
    })

    const spotlightedProductionCompanyIdSet: ReadonlySet<string> = $derived.by(() => {
        if (gameSession.cityReferenceCardPreviewWins) {
            return new Set<string>()
        }

        const productionCompanyIds = new Set<string>()

        for (const companyId of gameSession.activeBoardSpotlightProductionCompanyIds) {
            productionCompanyIds.add(companyId)
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

    const startedProductionZoneMarkers = $derived.by(() => {
        return gameSession.visibleStartedCompanyAnimationEntries
            .map((entry) =>
                startedProductionZoneMarkerEntryForAction({
                    gameState: gameSession.gameState,
                    action: entry.action,
                    ownerColor: gameSession.colors.getPlayerUiColor(entry.action.playerId)
                })
            )
            .filter((marker): marker is NonNullable<typeof marker> => marker !== null)
    })

    const maskNonSelectableZoneTagsDuringDeliverySelection: boolean = $derived.by(() => {
        if (gameSession.cityReferenceCardPreviewWins) {
            return false
        }
        return (
            gameSession.deliverySelectionEnabled &&
            gameSession.deliverySelectionStage === 'cultivated'
        )
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
        if (gameSession.cityReferenceCardPreviewWins) {
            return false
        }
        return spotlightedProductionCompanyIdSet.size > 0
    })

    const maskAllZoneTagsDuringNonProductionCompanyHover: boolean = $derived.by(() => {
        if (gameSession.cityReferenceCardPreviewWins) {
            return false
        }
        const hasAnyCompanySpotlight = gameSession.activeBoardSpotlightCompanyIds.length > 0
        return hasAnyCompanySpotlight && spotlightedProductionCompanyIdSet.size === 0
    })

    const hoveredRoutePreviewSourceAreaIdSet: ReadonlySet<string> = $derived.by(() => {
        return gameSession.activeRoutePreviewVisualState?.sourceAreaIdSet ?? new Set<string>()
    })

    const hasHoveredRoutePreview: boolean = $derived.by(() => {
        return gameSession.activeRoutePreviewVisualState !== null
    })

    const operatedCompanyIdSet: ReadonlySet<string> = $derived.by(() => {
        const state = gameSession.gameState.machineState
        const inOperationsPhase =
            state === MachineState.Operations ||
            state === MachineState.ShippingOperations ||
            state === MachineState.ProductionOperations
        return inOperationsPhase ? new Set(gameSession.gameState.operatedCompanyIds) : new Set<string>()
    })

    function isMarkerUnavailable(marker: ProductionZoneMarkerEntry): boolean {
        return operatedCompanyIdSet.has(marker.companyId)
    }

    function isMarkerMaskedByRoutePreview(marker: ProductionZoneMarkerEntry): boolean {
        if (!hasHoveredRoutePreview) {
            return false
        }
        return !marker.zoneAreaIds.some((areaId) => hoveredRoutePreviewSourceAreaIdSet.has(areaId))
    }

    function isMarkerMasked(marker: ProductionZoneMarkerEntry): boolean {
        if (isMarkerUnavailable(marker)) {
            return true
        }
        if (isMarkerMaskedByRoutePreview(marker)) {
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

    function isMarkerMaskedByCompanyHover(marker: ProductionZoneMarkerEntry): boolean {
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

    function maskedOpacityForMarker(marker: ProductionZoneMarkerEntry): number {
        if (!isMarkerMasked(marker)) {
            return 0
        }
        if (isMarkerUnavailable(marker)) {
            return OPERATED_ZONE_TAG_MASK_OPACITY
        }
        if (isMarkerMaskedByRoutePreview(marker)) {
            return HOVER_COMPANY_ZONE_TAG_MASK_OPACITY
        }
        if (
            maskNonSelectableZoneTagsDuringDeliverySelection &&
            !selectableDeliveryZoneMarkerKeySet.has(marker.key)
        ) {
            return SELECTION_ZONE_TAG_MASK_OPACITY
        }
        if (isMarkerMaskedByCompanyHover(marker)) {
            return HOVER_COMPANY_ZONE_TAG_MASK_OPACITY
        }
        return SELECTION_ZONE_TAG_MASK_OPACITY
    }

    function toggleProductionZoneRenderStyle(): void {
        gameSession.toggleProductionZoneRenderStyle()
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
        companyCultivatedZoneCache.clear()

        if (typeof window === 'undefined') {
            return
        }
        delete (
            window as Window & {
                __indonesiaProductionZoneMarkerEntries?: ProductionZoneMarkerEntry[]
                __setIndonesiaUiPerf?: (enabled: boolean) => void
            }
        ).__indonesiaProductionZoneMarkerEntries
        delete (
            window as Window & {
                __setIndonesiaUiPerf?: (enabled: boolean) => void
            }
        ).__setIndonesiaUiPerf
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
            maskedOpacity={maskedOpacityForMarker(marker)}
            onClick={toggleProductionZoneRenderStyle}
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
                maskedOpacity={maskedOpacityForMarker(marker)}
                onClick={toggleProductionZoneRenderStyle}
            />
        {/each}
    {/if}

    {#each startedProductionZoneMarkers as marker (marker.key)}
        <g
            opacity="0"
            use:animateStartedProductionMarker={{
                animator: startCompanyAnimator,
                companyId: marker.companyId
            }}
        >
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
                masked={false}
                maskedOpacity={0}
                onClick={toggleProductionZoneRenderStyle}
            />
        </g>
    {/each}
</g>
