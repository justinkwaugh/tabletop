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

    function parsePathRings(path: string): Array<Array<[number, number]>> {
        const subpaths = path.match(/M[^M]*?Z/g) ?? []
        return subpaths
            .map((subpath) => {
                const values = subpath.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
                const points: Array<[number, number]> = []
                for (let i = 0; i < values.length - 1; i += 2) {
                    points.push([values[i], values[i + 1]])
                }
                return points
            })
            .filter((ring) => ring.length > 1)
    }

    function pairKey(a: string, b: string): string {
        return a < b ? `${a}|${b}` : `${b}|${a}`
    }

    function computeAreaColorMap(areas: DebugArea[]): Map<string, string> {
        const boundaryPointOwners = new Map<string, Set<string>>()
        const sharedPointCountByPair = new Map<string, number>()
        const adjacency = new Map<string, Set<string>>()

        for (const area of areas) {
            adjacency.set(area.id, new Set())
            const rings = parsePathRings(area.path)

            for (const ring of rings) {
                const isClosed =
                    ring[0][0] === ring[ring.length - 1][0] &&
                    ring[0][1] === ring[ring.length - 1][1]
                const segmentCount = isClosed ? ring.length - 1 : ring.length

                for (let i = 0; i < segmentCount; i++) {
                    const [x1, y1] = ring[i]
                    const [x2, y2] = ring[(i + 1) % ring.length]
                    const dx = x2 - x1
                    const dy = y2 - y1
                    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))))

                    for (let step = 0; step <= steps; step++) {
                        const t = step / steps
                        const x = Math.round(x1 + dx * t)
                        const y = Math.round(y1 + dy * t)
                        const pointKey = `${x},${y}`
                        const owners = boundaryPointOwners.get(pointKey) ?? new Set<string>()
                        owners.add(area.id)
                        boundaryPointOwners.set(pointKey, owners)
                    }
                }
            }
        }

        for (const owners of boundaryPointOwners.values()) {
            if (owners.size < 2) continue
            const ids = [...owners]
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    const key = pairKey(ids[i], ids[j])
                    sharedPointCountByPair.set(key, (sharedPointCountByPair.get(key) ?? 0) + 1)
                }
            }
        }

        for (const [key, sharedCount] of sharedPointCountByPair.entries()) {
            // Ignore corner-only touching; require a short shared border run.
            if (sharedCount < 6) continue
            const [idA, idB] = key.split('|')
            adjacency.get(idA)?.add(idB)
            adjacency.get(idB)?.add(idA)
        }

        const sortedIds = [...adjacency.keys()].sort((a, b) => {
            const degreeDiff = (adjacency.get(b)?.size ?? 0) - (adjacency.get(a)?.size ?? 0)
            if (degreeDiff !== 0) return degreeDiff
            return a.localeCompare(b)
        })

        const areaColors = new Map<string, string>()
        const hasAdjacency = sortedIds.some((id) => (adjacency.get(id)?.size ?? 0) > 0)

        if (!hasAdjacency) {
            // Fallback so debug remains readable if geometry does not share exact sampled borders.
            for (const [index, id] of sortedIds.entries()) {
                areaColors.set(id, DEBUG_PALETTE[index % DEBUG_PALETTE.length])
            }
            return areaColors
        }

        for (const id of sortedIds) {
            const neighborColors = new Set(
                [...(adjacency.get(id) ?? [])]
                    .map((neighborId) => areaColors.get(neighborId))
                    .filter(Boolean)
            )
            const color =
                DEBUG_PALETTE.find((candidate) => !neighborColors.has(candidate)) ??
                DEBUG_PALETTE[0]
            areaColors.set(id, color)
        }

        // If geometry noise causes over-connected adjacency, greedy coloring can collapse
        // to too few colors. Keep debug legibility by falling back to palette cycling.
        const distinctColorCount = new Set(areaColors.values()).size
        if (distinctColorCount <= 4) {
            areaColors.clear()
            for (const [index, id] of sortedIds.entries()) {
                areaColors.set(id, DEBUG_PALETTE[index % DEBUG_PALETTE.length])
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

    const DEBUG_AREA_COLORS: Map<string, string> = $derived.by(() =>
        computeAreaColorMap(DEBUG_MAP_AREAS)
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
