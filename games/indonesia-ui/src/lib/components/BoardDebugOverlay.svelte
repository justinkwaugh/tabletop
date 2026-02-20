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
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    const gameSession = getGameSession()

    let { width, height }: { width: number; height: number } = $props()

    type OverlayMode = 'adjacency' | 'region' | 'sea'
    let colorMode: OverlayMode = $state('adjacency')

    type BoardNodeView = {
        id: string
        neighbors: string[]
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

    const DEBUG_PALETTE = ['#ff3b30', '#007aff', '#34c759', '#ffcc00', '#af52de', '#ff9500']

    function compareAreaIds(left: string, right: string): number {
        return left.localeCompare(right, undefined, { numeric: true })
    }

    function pairKey(a: string, b: string): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`
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
            neighbors: [...node.neighbors],
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

    const DISPLAY_AREAS: DebugArea[] = $derived.by(() =>
        colorMode === 'sea' ? SEA_DEBUG_MAP_AREAS : LAND_DEBUG_MAP_AREAS
    )

    const LAND_DEBUG_AREAS_BY_ID: Map<string, DebugArea> = $derived.by(
        () => new Map(LAND_DEBUG_MAP_AREAS.map((area) => [area.id, area]))
    )

    const BOARD_ADJACENCY: Map<string, Set<string>> = $derived.by(() => {
        const adjacency = new Map<string, Set<string>>()
        for (const node of BOARD_NODES) {
            const neighbors = adjacency.get(node.id) ?? new Set<string>()
            for (const neighborId of node.neighbors) {
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
        if (colorMode === 'sea') {
            return []
        }

        const connections: DebugConnection[] = []
        const seenEdgeIds = new Set<string>()

        for (const node of BOARD_NODES) {
            for (const neighborId of node.neighbors) {
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
        for (const id of sortedIds) {
            const neighborColors = new Set(
                [...(filteredAdjacency.get(id) ?? [])]
                    .map((neighborId) => areaColors.get(neighborId))
                    .filter(Boolean)
            )
            for (let colorIndex = 0; colorIndex < 256; colorIndex++) {
                const candidate = getPaletteColor(colorIndex)
                if (!neighborColors.has(candidate)) {
                    areaColors.set(id, candidate)
                    break
                }
            }
            if (!areaColors.has(id)) {
                areaColors.set(id, getPaletteColor(0))
            }
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
        if (colorMode === 'sea') {
            return computeSequentialColorMap(DISPLAY_AREAS)
        }
        if (colorMode === 'region') {
            return computeRegionColorMap(DISPLAY_AREAS)
        }
        return computeAdjacencyColorMap(DISPLAY_AREAS, BOARD_ADJACENCY)
    })
</script>

<div class="absolute inset-0 z-[2]">
    <div class="debug-controls">
        <button
            type="button"
            class:active={colorMode === 'adjacency'}
            onclick={() => {
                colorMode = 'adjacency'
            }}
        >
            Adjacency
        </button>
        <button
            type="button"
            class:active={colorMode === 'region'}
            onclick={() => {
                colorMode = 'region'
            }}
        >
            Region
        </button>
        <button
            type="button"
            class:active={colorMode === 'sea'}
            onclick={() => {
                colorMode = 'sea'
            }}
        >
            Sea
        </button>
    </div>

    <svg
        class="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Indonesia board debug overlay"
    >
        <g class="pointer-events-none" aria-label="Debug map geometry">
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
                ></path>
            {/each}
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
                >
                    {area.label}
                </text>
            {/each}
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
