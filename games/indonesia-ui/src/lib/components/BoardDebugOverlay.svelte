<script lang="ts">
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
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    const gameSession = getGameSession()

    let { width, height }: { width: number; height: number } = $props()

    type OverlayMode = 'none' | 'land' | 'coastal' | 'region' | 'sea' | 'production'
    let colorMode: OverlayMode = $state('none')
    let hoveredSeaId: string | null = $state(null)

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

    const DEBUG_PALETTE = ['#ff3b30', '#007aff', '#34c759', '#ffcc00', '#af52de', '#ff9500']
    const PRODUCTION_ICON_HEIGHT = 30
    const GLASS_BEAD_HEIGHT = 46
    const GLASS_BEAD_OPACITY = 0.85
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

    const DEBUG_AREA_COLORS: Map<string, string> = $derived.by(() => {
        if (colorMode === 'none') {
            return new Map()
        }
        if (colorMode === 'production') {
            return new Map()
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
    </div>

    <svg
        class="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Indonesia board debug overlay"
    >
        <g aria-label="Debug map geometry">
            {#if colorMode === 'production'}
                {#each LAND_DEBUG_MAP_AREAS as area (area.id)}
                    {@const markerType = PRODUCTION_MARKER_BY_AREA.get(area.id) ?? 'spice'}
                    {#if area.id === 'A34'}
                        <GlassBeadMarker
                            x={area.labelX}
                            y={area.labelY}
                            height={GLASS_BEAD_HEIGHT}
                            tone="green"
                            opacity={GLASS_BEAD_OPACITY}
                        />
                    {:else if markerType === 'spice'}
                        <SpiceMarker x={area.labelX} y={area.labelY} height={PRODUCTION_ICON_HEIGHT} />
                    {:else if markerType === 'siapsaji'}
                        <SiapSajiMarker
                            x={area.labelX}
                            y={area.labelY}
                            height={PRODUCTION_ICON_HEIGHT}
                        />
                    {:else if markerType === 'oil'}
                        <OilMarker x={area.labelX} y={area.labelY} height={PRODUCTION_ICON_HEIGHT} />
                    {:else if markerType === 'rice'}
                        <RiceMarker x={area.labelX} y={area.labelY} height={PRODUCTION_ICON_HEIGHT} />
                    {:else}
                        <RubberMarker
                            x={area.labelX}
                            y={area.labelY}
                            height={PRODUCTION_ICON_HEIGHT}
                        />
                    {/if}
                {/each}
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
            {#each DISPLAY_AREAS as area (area.id)}
                {@const areaColor = DEBUG_AREA_COLORS.get(area.id) ?? '#ff1e1e'}
                <path
                    d={area.path}
                    fill={areaColor}
                    fill-opacity="0.5"
                    fill-rule="evenodd"
                    stroke="#111827"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                    opacity="0.95"
                    pointer-events={colorMode === 'sea' ? 'all' : 'none'}
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
                ></path>
            {/each}
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
</style>
