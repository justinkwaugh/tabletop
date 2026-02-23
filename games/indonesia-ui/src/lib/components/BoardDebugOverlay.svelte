<script lang="ts">
    import { onMount } from 'svelte'
    import {
        EAST_ISLAND_AREAS,
        EASTCENTRAL_ISLAND_AREAS,
        LEFTMOST_ISLAND_AREAS,
        NORTHEAST_ISLAND_AREAS,
        SEA_AREAS,
        TOP_CENTER_ISLAND_AREAS,
        SOUTHCHAIN_ISLAND_AREAS,
        SOUTHLEFT_ISLAND_AREAS
    } from '$lib/definitions/boardGeometry.js'
    import SpiceMarker from '$lib/components/SpiceMarker.svelte'
    import SiapSajiMarker from '$lib/components/SiapSajiMarker.svelte'
    import OilMarker from '$lib/components/OilMarker.svelte'
    import RiceMarker from '$lib/components/RiceMarker.svelte'
    import RubberMarker from '$lib/components/RubberMarker.svelte'
    import GlassBeadMarker from '$lib/components/GlassBeadMarker.svelte'
    import { LAND_MARKER_POSITIONS } from '$lib/definitions/landMarkerPositions.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    const gameSession = getGameSession()

    let { width, height }: { width: number; height: number } = $props()

    type OverlayMode = 'none' | 'land' | 'coastal' | 'region' | 'sea' | 'production' | 'marker'
    type BeadTone = 'amber' | 'red' | 'green'
    let colorMode: OverlayMode = $state('none')
    let hoveredSeaId: string | null = $state(null)
    let debugSvgElement: SVGSVGElement | null = $state(null)
    let markerPositions: Record<string, { x: number; y: number }> = $state({})
    let markerPositionsLoaded = $state(false)
    let markerSelectedAreaId: string | null = $state(null)
    let markerDraggingAreaId: string | null = $state(null)
    let markerCopyStatus: string | null = $state(null)

    type BoardNodeAreaType = 'Land' | 'Sea'

    type BoardNodeView = {
        id: string
        type: BoardNodeAreaType
        landNeighbors: string[]
        seaNeighbors: string[]
        region: string | null
    }

    type DebugArea = {
        id: string
        path: string
        label: string
        labelX: number
        labelY: number
        region: string | null
    }

    type DebugConnection = {
        id: string
        x1: number
        y1: number
        x2: number
        y2: number
    }

    type ProductionMarkerType = 'spice' | 'siapsaji' | 'oil' | 'rice' | 'rubber'
    type ProductionMarkerPlacement = {
        areaId: string
        markerType: ProductionMarkerType | 'bead'
        x: number
        y: number
        beadTone?: BeadTone
    }

    const DEBUG_PALETTE = ['#ff3b30', '#007aff', '#34c759', '#ffcc00', '#af52de', '#ff9500']
    const PRODUCTION_ICON_HEIGHT = 30
    const GLASS_BEAD_HEIGHT = 46
    const GLASS_BEAD_OPACITY = 0.85
    const MARKER_POSITIONS_STORAGE_KEY = 'indonesia-marker-positions-v1'
    const LAND_MARKER_POSITION_LOOKUP = LAND_MARKER_POSITIONS as Record<
        string,
        { x: number; y: number }
    >
    const PRODUCTION_MARKER_TYPES: ProductionMarkerType[] = [
        'spice',
        'siapsaji',
        'oil',
        'rice',
        'rubber'
    ]
    const GLASS_BEAD_PREVIEW_MARKERS = [
        { x: 172, y: 90, tone: 'amber' },
        { x: 207, y: 103, tone: 'red' },
        { x: 243, y: 92, tone: 'green' },
        { x: 279, y: 104, tone: 'amber' },
        { x: 314, y: 92, tone: 'red' },
        { x: 349, y: 103, tone: 'green' }
    ] as const

    function compareAreaIds(left: string, right: string): number {
        return left.localeCompare(right, undefined, { numeric: true })
    }

    function pairKey(a: string, b: string): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`
    }

    function extractDirectionalNeighbors(neighbors: unknown, direction: 'Land' | 'Sea'): string[] {
        if (Array.isArray(neighbors)) {
            if (direction === 'Land') {
                return neighbors.filter(
                    (neighborId): neighborId is string => typeof neighborId === 'string'
                )
            }
            return []
        }

        if (neighbors && typeof neighbors === 'object') {
            const directionalNeighbors = (neighbors as Record<string, unknown>)[direction]
            if (Array.isArray(directionalNeighbors)) {
                return directionalNeighbors.filter(
                    (neighborId): neighborId is string => typeof neighborId === 'string'
                )
            }
        }

        return []
    }

    function extractLandNeighbors(neighbors: unknown): string[] {
        return extractDirectionalNeighbors(neighbors, 'Land')
    }

    function extractSeaNeighbors(neighbors: unknown): string[] {
        return extractDirectionalNeighbors(neighbors, 'Sea')
    }

    function extractNodeAreaType(nodeId: string, nodeType: unknown): BoardNodeAreaType {
        if (nodeType === 'Sea') {
            return 'Sea'
        }
        if (nodeType === 'Land') {
            return 'Land'
        }
        return nodeId.startsWith('S') ? 'Sea' : 'Land'
    }

    function getPaletteColor(index: number): string {
        if (index < DEBUG_PALETTE.length) {
            return DEBUG_PALETTE[index]
        }
        const hue = (index * 137.508) % 360
        return `hsl(${hue} 62% 54%)`
    }

    function getPathLabelPosition(path: string): { labelX: number; labelY: number } {
        const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY

        for (let i = 0; i < values.length - 1; i += 2) {
            const x = values[i]
            const y = values[i + 1]
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
        }

        return {
            labelX: (minX + maxX) / 2,
            labelY: (minY + maxY) / 2
        }
    }

    function toRoundedMarkerValue(value: number): number {
        return Math.round(value * 10) / 10
    }

    function getSvgCoordinates(event: PointerEvent): { x: number; y: number } | null {
        if (!debugSvgElement) {
            return null
        }
        const ctm = debugSvgElement.getScreenCTM()
        if (!ctm) {
            return null
        }
        const point = debugSvgElement.createSVGPoint()
        point.x = event.clientX
        point.y = event.clientY
        const transformed = point.matrixTransform(ctm.inverse())
        return {
            x: toRoundedMarkerValue(transformed.x),
            y: toRoundedMarkerValue(transformed.y)
        }
    }

    function setMarkerPositionForArea(areaId: string, x: number, y: number): void {
        markerPositions = {
            ...markerPositions,
            [areaId]: {
                x: toRoundedMarkerValue(x),
                y: toRoundedMarkerValue(y)
            }
        }
    }

    function getDefaultMarkerPositionForArea(area: DebugArea): { x: number; y: number } {
        const defaultPosition = LAND_MARKER_POSITION_LOOKUP[area.id]
        if (defaultPosition) {
            return {
                x: toRoundedMarkerValue(defaultPosition.x),
                y: toRoundedMarkerValue(defaultPosition.y)
            }
        }
        return {
            x: toRoundedMarkerValue(area.labelX),
            y: toRoundedMarkerValue(area.labelY)
        }
    }

    function getMarkerPositionForArea(area: DebugArea): { x: number; y: number } {
        const override = markerPositions[area.id]
        if (override) {
            return override
        }
        return getDefaultMarkerPositionForArea(area)
    }

    function startMarkerDrag(areaId: string, event: PointerEvent): void {
        if (colorMode !== 'marker') {
            return
        }
        markerSelectedAreaId = areaId
        markerDraggingAreaId = areaId
        const nextPoint = getSvgCoordinates(event)
        if (nextPoint) {
            setMarkerPositionForArea(areaId, nextPoint.x, nextPoint.y)
        }
        const target = event.currentTarget as Element | null
        target?.setPointerCapture?.(event.pointerId)
        event.preventDefault()
    }

    function stopMarkerDrag(): void {
        markerDraggingAreaId = null
    }

    function handleMarkerPointerMove(event: PointerEvent): void {
        if (colorMode !== 'marker' || !markerDraggingAreaId) {
            return
        }
        const nextPoint = getSvgCoordinates(event)
        if (!nextPoint) {
            return
        }
        setMarkerPositionForArea(markerDraggingAreaId, nextPoint.x, nextPoint.y)
    }

    function clearSelectedMarkerOverride(): void {
        if (!markerSelectedAreaId || markerPositions[markerSelectedAreaId] === undefined) {
            return
        }
        const nextPositions = { ...markerPositions }
        delete nextPositions[markerSelectedAreaId]
        markerPositions = nextPositions
    }

    function clearAllMarkerOverrides(): void {
        markerPositions = {}
    }

    async function copyToClipboard(value: string): Promise<void> {
        if (typeof navigator === 'undefined' || !navigator.clipboard) {
            markerCopyStatus = 'Clipboard unavailable'
            return
        }
        try {
            await navigator.clipboard.writeText(value)
            markerCopyStatus = 'Copied'
        } catch {
            markerCopyStatus = 'Copy failed'
        }
    }

    onMount(() => {
        if (typeof window === 'undefined') {
            return
        }
        try {
            const stored = window.localStorage.getItem(MARKER_POSITIONS_STORAGE_KEY)
            if (!stored) {
                markerPositionsLoaded = true
                return
            }
            const parsed = JSON.parse(stored) as Record<string, unknown>
            const nextPositions: Record<string, { x: number; y: number }> = {}
            for (const [areaId, value] of Object.entries(parsed)) {
                if (!value || typeof value !== 'object') {
                    continue
                }
                const candidate = value as { x?: unknown; y?: unknown }
                if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') {
                    continue
                }
                nextPositions[areaId] = {
                    x: toRoundedMarkerValue(candidate.x),
                    y: toRoundedMarkerValue(candidate.y)
                }
            }
            markerPositions = nextPositions
        } catch {
            markerPositions = {}
        } finally {
            markerPositionsLoaded = true
        }
    })

    $effect(() => {
        if (!markerPositionsLoaded || typeof window === 'undefined') {
            return
        }
        window.localStorage.setItem(MARKER_POSITIONS_STORAGE_KEY, JSON.stringify(markerPositions))
    })

    const BOARD_GEOMETRY_AREAS = [
        ...LEFTMOST_ISLAND_AREAS,
        ...SOUTHLEFT_ISLAND_AREAS,
        ...TOP_CENTER_ISLAND_AREAS,
        ...EASTCENTRAL_ISLAND_AREAS,
        ...SOUTHCHAIN_ISLAND_AREAS,
        ...NORTHEAST_ISLAND_AREAS,
        ...EAST_ISLAND_AREAS
    ]
    const BOARD_GEOMETRY_LOOKUP = new Map(
        BOARD_GEOMETRY_AREAS.map((area) => [area.id, area.path])
    )

    const BOARD_NODES: BoardNodeView[] = $derived.by(() => {
        const nodes = Array.from(gameSession.gameState.board, (node) => ({
            id: node.id,
            type: extractNodeAreaType(
                node.id,
                (node as {
                    type?: unknown
                }).type
            ),
            landNeighbors: extractLandNeighbors(node.neighbors),
            seaNeighbors: extractSeaNeighbors(node.neighbors),
            region: node.region
        }))
        nodes.sort((left, right) => compareAreaIds(left.id, right.id))
        return nodes
    })

    const LAND_DEBUG_MAP_AREAS: DebugArea[] = $derived.by(() => {
        const mappedAreas: DebugArea[] = []
        const seenIds = new Set<string>()

        for (const node of BOARD_NODES) {
            if (seenIds.has(node.id)) {
                continue
            }
            seenIds.add(node.id)

            const path = BOARD_GEOMETRY_LOOKUP.get(node.id)
            if (!path) {
                continue
            }

            mappedAreas.push({
                id: node.id,
                path,
                label: node.id,
                region: node.region,
                ...getPathLabelPosition(path)
            })
        }

        return mappedAreas
    })

    const SEA_DEBUG_MAP_AREAS: DebugArea[] = $derived.by(() => {
        const areas = SEA_AREAS.map((area) => ({
            id: area.id,
            path: area.path,
            label: area.id,
            region: null,
            ...getPathLabelPosition(area.path)
        }))
        areas.sort((left, right) => compareAreaIds(left.id, right.id))
        return areas
    })

    const COASTAL_LAND_AREA_IDS: Set<string> = $derived.by(() => {
        const coastalAreaIds = new Set<string>()
        for (const node of BOARD_NODES) {
            if (node.type !== 'Sea') {
                continue
            }
            for (const landNeighborId of node.landNeighbors) {
                coastalAreaIds.add(landNeighborId)
            }
        }
        return coastalAreaIds
    })

    const COASTAL_LAND_DEBUG_AREAS: DebugArea[] = $derived.by(() =>
        LAND_DEBUG_MAP_AREAS.filter((area) => COASTAL_LAND_AREA_IDS.has(area.id))
    )

    const DISPLAY_AREAS: DebugArea[] = $derived.by(() => {
        if (colorMode === 'none') {
            return []
        }
        if (colorMode === 'sea') {
            return SEA_DEBUG_MAP_AREAS
        }
        if (colorMode === 'coastal') {
            return COASTAL_LAND_DEBUG_AREAS
        }
        if (colorMode === 'production') {
            return []
        }
        if (colorMode === 'marker') {
            return LAND_DEBUG_MAP_AREAS
        }
        return LAND_DEBUG_MAP_AREAS
    })

    const LAND_DEBUG_AREAS_BY_ID: Map<string, DebugArea> = $derived.by(
        () => new Map(LAND_DEBUG_MAP_AREAS.map((area) => [area.id, area]))
    )

    const BOARD_NODES_BY_ID: Map<string, BoardNodeView> = $derived.by(
        () => new Map(BOARD_NODES.map((node) => [node.id, node]))
    )

    const BOARD_ADJACENCY: Map<string, Set<string>> = $derived.by(() => {
        const adjacency = new Map<string, Set<string>>()
        for (const node of BOARD_NODES) {
            const neighbors = adjacency.get(node.id) ?? new Set<string>()
            for (const neighborId of node.landNeighbors) {
                neighbors.add(neighborId)
                const reverseNeighbors = adjacency.get(neighborId) ?? new Set<string>()
                reverseNeighbors.add(node.id)
                adjacency.set(neighborId, reverseNeighbors)
            }
            adjacency.set(node.id, neighbors)
        }
        return adjacency
    })

    const DEBUG_CONNECTIONS: DebugConnection[] = $derived.by(() => {
        if (colorMode !== 'land') {
            return []
        }

        const connections: DebugConnection[] = []
        const seenEdgeIds = new Set<string>()

        for (const node of BOARD_NODES) {
            for (const neighborId of node.landNeighbors) {
                const edgeId = pairKey(node.id, neighborId)
                if (seenEdgeIds.has(edgeId)) {
                    continue
                }
                seenEdgeIds.add(edgeId)

                const from = LAND_DEBUG_AREAS_BY_ID.get(node.id)
                const to = LAND_DEBUG_AREAS_BY_ID.get(neighborId)
                if (!from || !to) {
                    continue
                }

                connections.push({
                    id: edgeId,
                    x1: from.labelX,
                    y1: from.labelY,
                    x2: to.labelX,
                    y2: to.labelY
                })
            }
        }

        connections.sort((left, right) => left.id.localeCompare(right.id))
        return connections
    })

    const HOVERED_SEA_LAND_AREAS: DebugArea[] = $derived.by(() => {
        if (colorMode !== 'sea' || !hoveredSeaId) {
            return []
        }

        const seaNode = BOARD_NODES_BY_ID.get(hoveredSeaId)
        if (!seaNode || seaNode.type !== 'Sea') {
            return []
        }

        return seaNode.landNeighbors
            .map((neighborId) => LAND_DEBUG_AREAS_BY_ID.get(neighborId))
            .filter((area): area is DebugArea => area !== undefined)
            .sort((left, right) => compareAreaIds(left.id, right.id))
    })

    const SELECTED_MARKER_AREA: DebugArea | null = $derived.by(() => {
        if (!markerSelectedAreaId) {
            return null
        }
        return LAND_DEBUG_AREAS_BY_ID.get(markerSelectedAreaId) ?? null
    })

    const PRODUCTION_MARKER_BY_AREA: Map<string, ProductionMarkerType> = $derived.by(() => {
        const regionIds = [
            ...new Set(
                LAND_DEBUG_MAP_AREAS.map((area) => area.region).filter(
                    (regionId): regionId is string => regionId !== null
                )
            )
        ].sort((left, right) => left.localeCompare(right))

        const markerByRegion = new Map<string, ProductionMarkerType>()
        for (const [regionIndex, regionId] of regionIds.entries()) {
            markerByRegion.set(
                regionId,
                PRODUCTION_MARKER_TYPES[regionIndex % PRODUCTION_MARKER_TYPES.length]
            )
        }

        const markerByArea = new Map<string, ProductionMarkerType>()
        for (const [areaIndex, area] of LAND_DEBUG_MAP_AREAS.entries()) {
            if (area.region) {
                markerByArea.set(area.id, markerByRegion.get(area.region) ?? 'spice')
                continue
            }
            markerByArea.set(area.id, PRODUCTION_MARKER_TYPES[areaIndex % PRODUCTION_MARKER_TYPES.length])
        }

        return markerByArea
    })

    function buildProductionMarkers(
        resolvePosition: (area: DebugArea) => { x: number; y: number }
    ): ProductionMarkerPlacement[] {
        const placements: ProductionMarkerPlacement[] = []
        for (const area of LAND_DEBUG_MAP_AREAS) {
            const markerPosition = resolvePosition(area)
            if (area.id === 'A34') {
                placements.push({
                    areaId: area.id,
                    markerType: 'bead',
                    beadTone: 'green',
                    x: markerPosition.x,
                    y: markerPosition.y
                })
                continue
            }
            placements.push({
                areaId: area.id,
                markerType: PRODUCTION_MARKER_BY_AREA.get(area.id) ?? 'spice',
                x: markerPosition.x,
                y: markerPosition.y
            })
        }
        return placements
    }

    const PRODUCTION_MARKERS: ProductionMarkerPlacement[] = $derived.by(() =>
        buildProductionMarkers(getDefaultMarkerPositionForArea)
    )

    const MARKER_MODE_MARKERS: ProductionMarkerPlacement[] = $derived.by(() =>
        buildProductionMarkers(getMarkerPositionForArea)
    )

    const DISPLAYED_MARKERS: ProductionMarkerPlacement[] = $derived.by(() => {
        if (colorMode === 'marker') {
            return MARKER_MODE_MARKERS
        }
        return PRODUCTION_MARKERS
    })

    const MARKER_OVERRIDES_EXPORT_TEXT: string = $derived.by(() => {
        const ids = Object.keys(markerPositions).sort(compareAreaIds)
        if (ids.length === 0) {
            return '// No marker overrides yet.'
        }
        const lines = ids.map((areaId) => {
            const point = markerPositions[areaId]
            return `    ${areaId}: { x: ${point.x.toFixed(1)}, y: ${point.y.toFixed(1)} },`
        })
        return `export const LAND_MARKER_POSITIONS = {\n${lines.join('\n')}\n} as const`
    })

    const MARKER_FULL_EXPORT_TEXT: string = $derived.by(() => {
        const lines = LAND_DEBUG_MAP_AREAS.map((area) => {
            const point = getMarkerPositionForArea(area)
            return `    ${area.id}: { x: ${point.x.toFixed(1)}, y: ${point.y.toFixed(1)} },`
        })
        return `export const LAND_MARKER_POSITIONS = {\n${lines.join('\n')}\n} as const`
    })

    function computeAdjacencyColorMap(
        areas: DebugArea[],
        adjacency: Map<string, Set<string>>
    ): Map<string, string> {
        const areaIdSet = new Set(areas.map((area) => area.id))
        const filteredAdjacency = new Map<string, Set<string>>()
        for (const id of areaIdSet) {
            const neighbors = adjacency.get(id) ?? new Set<string>()
            filteredAdjacency.set(
                id,
                new Set([...neighbors].filter((neighborId) => areaIdSet.has(neighborId)))
            )
        }

        const sortedIds = [...filteredAdjacency.keys()].sort((a, b) => {
            const degreeDiff =
                (filteredAdjacency.get(b)?.size ?? 0) - (filteredAdjacency.get(a)?.size ?? 0)
            if (degreeDiff !== 0) return degreeDiff
            return compareAreaIds(a, b)
        })

        const areaColors = new Map<string, string>()
        const colorUsage = new Map<string, number>()
        const colorCandidateCount = Math.max(sortedIds.length, DEBUG_PALETTE.length)

        for (const id of sortedIds) {
            const neighborColors = new Set(
                [...(filteredAdjacency.get(id) ?? [])]
                    .map((neighborId) => areaColors.get(neighborId))
                    .filter(Boolean)
            )

            let selectedColor: string | null = null
            let selectedColorUsage = Number.POSITIVE_INFINITY

            // Prefer unused colors first, then least-used colors, while still
            // respecting adjacency constraints.
            for (let colorIndex = 0; colorIndex < colorCandidateCount; colorIndex++) {
                const candidate = getPaletteColor(colorIndex)
                if (neighborColors.has(candidate)) {
                    continue
                }

                const usage = colorUsage.get(candidate) ?? 0
                if (usage < selectedColorUsage) {
                    selectedColor = candidate
                    selectedColorUsage = usage
                }
            }

            if (selectedColor === null) {
                selectedColor = getPaletteColor(colorCandidateCount)
            }

            areaColors.set(id, selectedColor)
            colorUsage.set(selectedColor, (colorUsage.get(selectedColor) ?? 0) + 1)
        }

        return areaColors
    }

    function computeRegionColorMap(areas: DebugArea[]): Map<string, string> {
        const regionIds = [
            ...new Set(
                areas
                    .map((area) => area.region)
                    .filter((regionId): regionId is string => regionId !== null)
            )
        ].sort((left, right) => left.localeCompare(right))

        const regionColorMap = new Map<string, string>()
        for (const [index, regionId] of regionIds.entries()) {
            regionColorMap.set(regionId, getPaletteColor(index))
        }

        const areaColors = new Map<string, string>()
        for (const area of areas) {
            if (!area.region) {
                areaColors.set(area.id, '#9ca3af')
                continue
            }
            areaColors.set(area.id, regionColorMap.get(area.region) ?? '#9ca3af')
        }

        return areaColors
    }

    function computeSequentialColorMap(areas: DebugArea[]): Map<string, string> {
        const areaColors = new Map<string, string>()
        for (const [index, area] of areas.entries()) {
            areaColors.set(area.id, getPaletteColor(index))
        }
        return areaColors
    }

    function computeMarkerTuneColorMap(areas: DebugArea[]): Map<string, string> {
        const areaColors = new Map<string, string>()
        for (const area of areas) {
            areaColors.set(area.id, area.id === markerSelectedAreaId ? '#f59e0b' : '#93c5fd')
        }
        return areaColors
    }

    const DEBUG_AREA_COLORS: Map<string, string> = $derived.by(() => {
        if (colorMode === 'none') {
            return new Map()
        }
        if (colorMode === 'production') {
            return new Map()
        }
        if (colorMode === 'marker') {
            return computeMarkerTuneColorMap(DISPLAY_AREAS)
        }
        if (colorMode === 'sea') {
            return computeSequentialColorMap(DISPLAY_AREAS)
        }
        if (colorMode === 'region') {
            return computeRegionColorMap(DISPLAY_AREAS)
        }
        if (colorMode === 'coastal') {
            return computeAdjacencyColorMap(DISPLAY_AREAS, BOARD_ADJACENCY)
        }
        return computeAdjacencyColorMap(DISPLAY_AREAS, BOARD_ADJACENCY)
    })
</script>

<div class="absolute inset-0 z-[2]">
    <div class="debug-controls">
        <button
            type="button"
            class:active={colorMode === 'none'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'none'
            }}
        >
            None
        </button>
        <button
            type="button"
            class:active={colorMode === 'land'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'land'
            }}
        >
            Land
        </button>
        <button
            type="button"
            class:active={colorMode === 'coastal'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'coastal'
            }}
        >
            Coastal
        </button>
        <button
            type="button"
            class:active={colorMode === 'region'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'region'
            }}
        >
            Region
        </button>
        <button
            type="button"
            class:active={colorMode === 'sea'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'sea'
            }}
        >
            Sea
        </button>
        <button
            type="button"
            class:active={colorMode === 'production'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'production'
            }}
        >
            Production
        </button>
        <button
            type="button"
            class:active={colorMode === 'marker'}
            onclick={() => {
                hoveredSeaId = null
                colorMode = 'marker'
            }}
        >
            Markers
        </button>
    </div>
    {#if colorMode === 'marker'}
        <div class="marker-tune-panel">
            <div class="marker-tune-title">Marker Placement</div>
            <div class="marker-tune-row">
                <span>Selected:</span>
                <strong>{markerSelectedAreaId ?? 'None'}</strong>
            </div>
            {#if SELECTED_MARKER_AREA}
                {@const selectedPoint = getMarkerPositionForArea(SELECTED_MARKER_AREA)}
                <div class="marker-tune-row">
                    <span>X:</span>
                    <code>{selectedPoint.x.toFixed(1)}</code>
                    <span>Y:</span>
                    <code>{selectedPoint.y.toFixed(1)}</code>
                </div>
            {/if}
            <div class="marker-tune-row marker-tune-buttons">
                <button type="button" onclick={clearSelectedMarkerOverride}>Clear Selected</button>
                <button type="button" onclick={clearAllMarkerOverrides}>Clear All</button>
            </div>
            <div class="marker-tune-row marker-tune-buttons">
                <button type="button" onclick={() => copyToClipboard(MARKER_OVERRIDES_EXPORT_TEXT)}>
                    Copy Overrides
                </button>
                <button type="button" onclick={() => copyToClipboard(MARKER_FULL_EXPORT_TEXT)}>
                    Copy Full
                </button>
            </div>
            <div class="marker-tune-row">
                <span>Overrides:</span>
                <strong>{Object.keys(markerPositions).length}</strong>
                {#if markerCopyStatus}
                    <em>{markerCopyStatus}</em>
                {/if}
            </div>
            <label class="marker-tune-label" for="marker-overrides-export">Overrides Export</label>
            <textarea id="marker-overrides-export" readonly value={MARKER_OVERRIDES_EXPORT_TEXT}></textarea>
            <label class="marker-tune-label" for="marker-full-export">Full Export</label>
            <textarea id="marker-full-export" readonly value={MARKER_FULL_EXPORT_TEXT}></textarea>
        </div>
    {/if}

    <svg
        bind:this={debugSvgElement}
        class="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Indonesia board debug overlay"
        onpointermove={handleMarkerPointerMove}
        onpointerup={stopMarkerDrag}
        onpointercancel={stopMarkerDrag}
        onpointerleave={stopMarkerDrag}
    >
        <g aria-label="Debug map geometry">
            {#each DISPLAY_AREAS as area (area.id)}
                {@const areaColor = DEBUG_AREA_COLORS.get(area.id) ?? '#ff1e1e'}
                <path
                    d={area.path}
                    fill={areaColor}
                    fill-opacity={colorMode === 'marker' ? '0.22' : '0.5'}
                    fill-rule="evenodd"
                    stroke="#111827"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                    opacity="0.95"
                    pointer-events={colorMode === 'sea' || colorMode === 'marker' ? 'all' : 'none'}
                    onmouseenter={() => {
                        if (colorMode === 'sea') {
                            hoveredSeaId = area.id
                        }
                    }}
                    onmouseleave={() => {
                        if (colorMode === 'sea' && hoveredSeaId === area.id) {
                            hoveredSeaId = null
                        }
                    }}
                    onpointerdown={() => {
                        if (colorMode === 'marker') {
                            markerSelectedAreaId = area.id
                        }
                    }}
                ></path>
            {/each}
            {#if colorMode === 'marker' && SELECTED_MARKER_AREA}
                <path
                    d={SELECTED_MARKER_AREA.path}
                    fill="none"
                    stroke="#f59e0b"
                    stroke-width="2.6"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                    opacity="0.95"
                    pointer-events="none"
                ></path>
            {/if}
            {#if colorMode === 'production' || colorMode === 'marker'}
                {#each DISPLAYED_MARKERS as marker (marker.areaId)}
                    {#if marker.markerType === 'bead'}
                        <GlassBeadMarker
                            x={marker.x}
                            y={marker.y}
                            height={GLASS_BEAD_HEIGHT}
                            tone={marker.beadTone ?? 'green'}
                            opacity={GLASS_BEAD_OPACITY}
                        />
                    {:else if marker.markerType === 'spice'}
                        <SpiceMarker x={marker.x} y={marker.y} height={PRODUCTION_ICON_HEIGHT} />
                    {:else if marker.markerType === 'siapsaji'}
                        <SiapSajiMarker
                            x={marker.x}
                            y={marker.y}
                            height={PRODUCTION_ICON_HEIGHT}
                        />
                    {:else if marker.markerType === 'oil'}
                        <OilMarker x={marker.x} y={marker.y} height={PRODUCTION_ICON_HEIGHT} />
                    {:else if marker.markerType === 'rice'}
                        <RiceMarker x={marker.x} y={marker.y} height={PRODUCTION_ICON_HEIGHT} />
                    {:else}
                        <RubberMarker
                            x={marker.x}
                            y={marker.y}
                            height={PRODUCTION_ICON_HEIGHT}
                        />
                    {/if}
                    {#if colorMode === 'marker'}
                        <circle
                            cx={marker.x}
                            cy={marker.y}
                            r={marker.areaId === markerSelectedAreaId ? 8 : 6.5}
                            fill={marker.areaId === markerSelectedAreaId ? '#fef3c7' : '#ffffff'}
                            fill-opacity="0.35"
                            stroke={marker.areaId === markerSelectedAreaId ? '#b45309' : '#1f2937'}
                            stroke-width={marker.areaId === markerSelectedAreaId ? 2.2 : 1.5}
                            pointer-events="all"
                            onpointerdown={(event) => startMarkerDrag(marker.areaId, event)}
                        ></circle>
                    {/if}
                {/each}
                {#if colorMode === 'production'}
                    {#each GLASS_BEAD_PREVIEW_MARKERS as marker, markerIndex (`glass-${markerIndex}`)}
                        <GlassBeadMarker
                            x={marker.x}
                            y={marker.y}
                            height={GLASS_BEAD_HEIGHT}
                            tone={marker.tone}
                            opacity={GLASS_BEAD_OPACITY}
                        />
                    {/each}
                {/if}
            {/if}
            {#if colorMode === 'sea'}
                {#each HOVERED_SEA_LAND_AREAS as area (area.id)}
                    <path
                        d={area.path}
                        fill="#fde68a"
                        fill-opacity="0.68"
                        stroke="#92400e"
                        stroke-width="2.2"
                        stroke-linejoin="round"
                        stroke-linecap="round"
                        opacity="0.95"
                        pointer-events="none"
                    ></path>
                {/each}
            {/if}
            {#each DEBUG_CONNECTIONS as connection (connection.id)}
                <line
                    x1={connection.x1}
                    y1={connection.y1}
                    x2={connection.x2}
                    y2={connection.y2}
                    stroke="#374151"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    opacity="0.85"
                    pointer-events="none"
                ></line>
            {/each}
            {#each DISPLAY_AREAS as area (area.id)}
                <text
                    x={area.labelX}
                    y={area.labelY}
                    fill="#111827"
                    stroke="#ffffff"
                    stroke-width="1.3"
                    paint-order="stroke fill"
                    font-size="14"
                    font-weight="700"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    pointer-events="none"
                >
                    {area.label}
                </text>
            {/each}
            {#if colorMode === 'sea'}
                {#each HOVERED_SEA_LAND_AREAS as area (area.id)}
                    <text
                        x={area.labelX}
                        y={area.labelY}
                        fill="#78350f"
                        stroke="#fef3c7"
                        stroke-width="1.1"
                        paint-order="stroke fill"
                        font-size="12"
                        font-weight="700"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        pointer-events="none"
                    >
                        {area.label}
                    </text>
                {/each}
            {/if}
        </g>
    </svg>
</div>

<style>
    .debug-controls {
        position: absolute;
        top: 12px;
        left: 12px;
        z-index: 4;
        display: inline-flex;
        gap: 6px;
        padding: 6px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.85);
        box-shadow: 0 1px 3px rgba(17, 24, 39, 0.18);
    }

    .debug-controls button {
        border: 1px solid rgba(17, 24, 39, 0.25);
        background: rgba(255, 255, 255, 0.65);
        color: #111827;
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
    }

    .debug-controls button.active {
        background: #1f2937;
        color: #ffffff;
        border-color: #111827;
    }

    .marker-tune-panel {
        position: absolute;
        bottom: 12px;
        left: 12px;
        z-index: 4;
        width: 340px;
        display: grid;
        gap: 8px;
        padding: 10px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 1px 3px rgba(17, 24, 39, 0.22);
        border: 1px solid rgba(17, 24, 39, 0.12);
    }

    .marker-tune-title {
        font-size: 13px;
        font-weight: 700;
        color: #111827;
    }

    .marker-tune-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #1f2937;
    }

    .marker-tune-row code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
        font-size: 12px;
        padding: 1px 4px;
        border-radius: 4px;
        background: rgba(15, 23, 42, 0.06);
    }

    .marker-tune-row em {
        color: #0f766e;
        font-style: normal;
        font-weight: 700;
    }

    .marker-tune-buttons {
        gap: 6px;
    }

    .marker-tune-buttons button {
        border: 1px solid rgba(17, 24, 39, 0.25);
        background: rgba(255, 255, 255, 0.78);
        color: #111827;
        border-radius: 8px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.1;
        cursor: pointer;
    }

    .marker-tune-label {
        font-size: 11px;
        color: #374151;
        font-weight: 600;
    }

    .marker-tune-panel textarea {
        width: 100%;
        min-height: 84px;
        resize: vertical;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
        font-size: 11px;
        line-height: 1.35;
        border: 1px solid rgba(17, 24, 39, 0.25);
        border-radius: 8px;
        padding: 6px 8px;
        background: rgba(255, 255, 255, 0.95);
        color: #111827;
    }
</style>
