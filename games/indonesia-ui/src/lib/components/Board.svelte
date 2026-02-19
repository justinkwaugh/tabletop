<script lang="ts">
    import boardImg from '$lib/images/indo_map_sm.jpg'
    import {
        EAST_ISLAND_AREAS,
        EASTCENTRAL_ISLAND_AREAS,
        LEFTMOST_ISLAND_AREAS,
        NORTHEAST_ISLAND_AREAS,
        TOP_CENTER_ISLAND_AREAS,
        SOUTHCHAIN_ISLAND_AREAS,
        SOUTHLEFT_ISLAND_AREAS
    } from '$lib/definitions/boardGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    const gameSession = getGameSession()

    const BOARD_WIDTH = 2646
    const BOARD_HEIGHT = 1280
    const SHOW_DEBUG_GEOMETRY = true

    type DebugArea = {
        id: string
        path: string
        label: string
        labelX: number
        labelY: number
    }

    type DebugConnection = {
        id: string
        fromId: string
        toId: string
        x1: number
        y1: number
        x2: number
        y2: number
    }

    const DEBUG_PALETTE = ['#ff3b30', '#007aff', '#34c759', '#ffcc00', '#af52de', '#ff9500']

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

    function getCompactAreaLabel(id: string): string {
        if (/^[A-Z]\d{2}$/.test(id)) {
            return id
        }
        const match = id.match(/(\d+)$/)
        const suffix = match?.[1]?.padStart(2, '0') ?? '??'
        return `B${suffix}`
    }

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

    function computeAreaColorMap(
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
            const degreeDiff = (adjacency.get(b)?.size ?? 0) - (adjacency.get(a)?.size ?? 0)
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
            let colorIndex = 0
            for (; colorIndex < 256; colorIndex++) {
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

    const BOARD_NODE_IDS: string[] = $derived.by(() => {
        const ids = Array.from(gameSession.gameState.board, (node) => node.id)
        ids.sort(compareAreaIds)
        return ids
    })

    const DEBUG_MAP_AREAS: DebugArea[] = $derived.by(() => {
        const mappedAreas: DebugArea[] = []
        const seenIds = new Set<string>()

        for (const id of BOARD_NODE_IDS) {
            if (seenIds.has(id)) {
                continue
            }
            seenIds.add(id)

            const path = BOARD_GEOMETRY_LOOKUP.get(id)
            if (!path) {
                continue
            }

            mappedAreas.push({
                id,
                path,
                label: getCompactAreaLabel(id),
                ...getPathLabelPosition(path)
            })
        }

        return mappedAreas
    })

    const DEBUG_AREAS_BY_ID: Map<string, DebugArea> = $derived.by(
        () => new Map(DEBUG_MAP_AREAS.map((area) => [area.id, area]))
    )

    const BOARD_ADJACENCY: Map<string, Set<string>> = $derived.by(() => {
        const adjacency = new Map<string, Set<string>>()
        for (const node of gameSession.gameState.board) {
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
        const connections: DebugConnection[] = []
        const seenEdgeIds = new Set<string>()

        for (const node of gameSession.gameState.board) {
            for (const neighborId of node.neighbors) {
                const edgeId = pairKey(node.id, neighborId)
                if (seenEdgeIds.has(edgeId)) {
                    continue
                }
                seenEdgeIds.add(edgeId)

                const from = DEBUG_AREAS_BY_ID.get(node.id)
                const to = DEBUG_AREAS_BY_ID.get(neighborId)
                if (!from || !to) {
                    continue
                }

                connections.push({
                    id: edgeId,
                    fromId: node.id,
                    toId: neighborId,
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

    const DEBUG_AREA_COLORS: Map<string, string> = $derived.by(() =>
        computeAreaColorMap(DEBUG_MAP_AREAS, BOARD_ADJACENCY)
    )
</script>

<div class="board-shell">
    <div class="board-surface relative h-[1280px] w-[2646px]">
        <img
            src={boardImg}
            alt="Indonesia game board"
            class="board-image absolute inset-0 h-full w-full"
        />
        <svg
            class="absolute inset-0 z-[2] h-full w-full"
            viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
            aria-label="Indonesia board overlay"
        >
            {#if SHOW_DEBUG_GEOMETRY}
                <g class="pointer-events-none" aria-label="Debug map geometry">
                    {#each DEBUG_MAP_AREAS as area (area.id)}
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
                    {#each DEBUG_MAP_AREAS as area (area.id)}
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
            {/if}
        </svg>
    </div>
</div>

<style>
    .board-shell {
        position: relative;
        display: inline-flex;
        padding: 10px;
        border-radius: 20px;
        background:
            radial-gradient(980px 620px at 14% 10%, rgba(255, 255, 255, 0.4), transparent 64%),
            repeating-linear-gradient(
                -30deg,
                rgba(126, 134, 148, 0.018) 0 2px,
                rgba(255, 255, 255, 0.015) 2px 7px
            ),
            #eceae4;
    }

    .board-surface {
        border-radius: 14px;
        overflow: hidden;
        box-shadow:
            0 0 0 5px rgba(123, 131, 146, 0.24),
            0 10px 22px rgba(17, 24, 39, 0.12);
    }

    .board-image {
        filter: none;
    }
</style>
