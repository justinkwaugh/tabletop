<script lang="ts">
    import boardImg from '$lib/images/indo_map_sm.jpg'
    import { LEFTMOST_ISLAND_AREAS } from '$lib/definitions/boardGeometry.js'
    import { TOP_CENTER_ISLAND_AREAS_SMOOTHED } from '$lib/definitions/boardGeometrySmoothed.js'

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

    function closestPointOnSegment(
        px: number,
        py: number,
        ax: number,
        ay: number,
        bx: number,
        by: number
    ): { x: number; y: number; dist2: number } {
        const abx = bx - ax
        const aby = by - ay
        const apx = px - ax
        const apy = py - ay
        const abLen2 = abx * abx + aby * aby

        if (abLen2 === 0) {
            const dx = px - ax
            const dy = py - ay
            return { x: ax, y: ay, dist2: dx * dx + dy * dy }
        }

        const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2))
        const x = ax + abx * t
        const y = ay + aby * t
        const dx = px - x
        const dy = py - y
        return { x, y, dist2: dx * dx + dy * dy }
    }

    function findClosestPointOnPath(
        path: string,
        targetX: number,
        targetY: number
    ): { x: number; y: number } | undefined {
        const rings = parsePathRings(path)
        let best: { x: number; y: number; dist2: number } | undefined

        for (const ring of rings) {
            if (ring.length < 2) continue
            for (let i = 0; i < ring.length - 1; i++) {
                const [ax, ay] = ring[i]
                const [bx, by] = ring[i + 1]
                const candidate = closestPointOnSegment(targetX, targetY, ax, ay, bx, by)
                if (!best || candidate.dist2 < best.dist2) {
                    best = candidate
                }
            }
        }

        if (!best) return undefined
        return { x: best.x, y: best.y }
    }

    function findSouthwestPoint(path: string): { x: number; y: number } | undefined {
        const rings = parsePathRings(path)
        let best: { x: number; y: number } | undefined

        for (const ring of rings) {
            for (const [x, y] of ring) {
                if (!best || y > best.y || (y === best.y && x < best.x)) {
                    best = { x, y }
                }
            }
        }

        return best
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
        if (distinctColorCount < 4) {
            areaColors.clear()
            for (const [index, id] of sortedIds.entries()) {
                areaColors.set(id, DEBUG_PALETTE[index % DEBUG_PALETTE.length])
            }
        }

        return areaColors
    }

    const DEBUG_LEFTMOST_AREAS: DebugArea[] = LEFTMOST_ISLAND_AREAS.map((area) => ({
        ...area,
        label: getCompactAreaLabel(area.id),
        ...getPathLabelPosition(area.path)
    }))

    const DEBUG_BORNEO_AREAS: DebugArea[] = TOP_CENTER_ISLAND_AREAS_SMOOTHED.map((area) => ({
        ...area,
        label: getCompactAreaLabel(area.id),
        ...getPathLabelPosition(area.path)
    }))

    const DEBUG_MAP_AREAS: DebugArea[] = [...DEBUG_LEFTMOST_AREAS, ...DEBUG_BORNEO_AREAS]
    const DEBUG_AREA_COLORS: Map<string, string> = computeAreaColorMap(DEBUG_MAP_AREAS)
    const DEBUG_A23_PATH: string | undefined = DEBUG_LEFTMOST_AREAS.find(
        (area) => area.id === 'A23'
    )?.path
    const DEBUG_A25_PATH: string | undefined = DEBUG_LEFTMOST_AREAS.find(
        (area) => area.id === 'A25'
    )?.path
    const DEBUG_PROVIDED_A23_SPLIT_PATH_SVG =
        'M867,1001.98c-18.96,8.38-38.54,15.51-55.99,27.01-8.26,5.44-17.93,4.55-27.03,5.86-14.04,2.02-33.49,5.9-46.78,10.76'
    const DEBUG_PROVIDED_A23_SPLIT_SCALE = 0.645
    const DEBUG_PROVIDED_A23_SPLIT_ANCHOR_X = 611
    const DEBUG_PROVIDED_A23_SPLIT_ANCHOR_Y = 751
    const DEBUG_PROVIDED_A23_SPLIT_SOURCE_RIGHT_X = 867
    const DEBUG_PROVIDED_A23_SPLIT_SOURCE_RIGHT_Y = 1001.98
    const DEBUG_PROVIDED_A23_SPLIT_TRANSLATE_X =
        DEBUG_PROVIDED_A23_SPLIT_ANCHOR_X -
        DEBUG_PROVIDED_A23_SPLIT_SCALE * DEBUG_PROVIDED_A23_SPLIT_SOURCE_RIGHT_X
    const DEBUG_PROVIDED_A23_SPLIT_TRANSLATE_Y =
        DEBUG_PROVIDED_A23_SPLIT_ANCHOR_Y -
        DEBUG_PROVIDED_A23_SPLIT_SCALE * DEBUG_PROVIDED_A23_SPLIT_SOURCE_RIGHT_Y
    const DEBUG_PROVIDED_A23_SPLIT_PATH_TRANSFORM = `translate(${DEBUG_PROVIDED_A23_SPLIT_TRANSLATE_X} ${DEBUG_PROVIDED_A23_SPLIT_TRANSLATE_Y}) scale(${DEBUG_PROVIDED_A23_SPLIT_SCALE})`
    const DEBUG_PROVIDED_A23_SPLIT_SOURCE_LEFT_X = 737.2
    const DEBUG_PROVIDED_A23_SPLIT_SOURCE_LEFT_Y = 1045.61
    const DEBUG_PROVIDED_A23_SPLIT_LEFT_X =
        DEBUG_PROVIDED_A23_SPLIT_TRANSLATE_X +
        DEBUG_PROVIDED_A23_SPLIT_SCALE * DEBUG_PROVIDED_A23_SPLIT_SOURCE_LEFT_X
    const DEBUG_PROVIDED_A23_SPLIT_LEFT_Y =
        DEBUG_PROVIDED_A23_SPLIT_TRANSLATE_Y +
        DEBUG_PROVIDED_A23_SPLIT_SCALE * DEBUG_PROVIDED_A23_SPLIT_SOURCE_LEFT_Y
    const DEBUG_A23_INTERSECTION_POINT =
        DEBUG_A23_PATH &&
        findClosestPointOnPath(
            DEBUG_A23_PATH,
            DEBUG_PROVIDED_A23_SPLIT_LEFT_X,
            DEBUG_PROVIDED_A23_SPLIT_LEFT_Y
        )
    const DEBUG_A25_SW_POINT = DEBUG_A25_PATH && findSouthwestPoint(DEBUG_A25_PATH)
    const DEBUG_A23_AT_A25_SW_POINT =
        DEBUG_A23_PATH &&
        DEBUG_A25_SW_POINT &&
        findClosestPointOnPath(DEBUG_A23_PATH, DEBUG_A25_SW_POINT.x, DEBUG_A25_SW_POINT.y)
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
                    {#if DEBUG_A23_PATH}
                        <path
                            d={DEBUG_A23_PATH}
                            fill="none"
                            stroke="#ffea00"
                            stroke-width="2"
                            stroke-linejoin="round"
                            stroke-linecap="round"
                            opacity="1"
                        ></path>
                    {/if}
                    <path
                        d={DEBUG_PROVIDED_A23_SPLIT_PATH_SVG}
                        transform={DEBUG_PROVIDED_A23_SPLIT_PATH_TRANSFORM}
                        fill="none"
                        stroke="#ff0000"
                        stroke-width="2"
                        stroke-linejoin="round"
                        stroke-linecap="round"
                        opacity="1"
                    ></path>
                    {#if DEBUG_A23_INTERSECTION_POINT}
                        <circle
                            cx={DEBUG_A23_INTERSECTION_POINT.x}
                            cy={DEBUG_A23_INTERSECTION_POINT.y}
                            r="2"
                            fill="#22c55e"
                            stroke="#14532d"
                            stroke-width="1"
                        ></circle>
                    {/if}
                    {#if DEBUG_A23_AT_A25_SW_POINT}
                        <circle
                            cx={DEBUG_A23_AT_A25_SW_POINT.x}
                            cy={DEBUG_A23_AT_A25_SW_POINT.y}
                            r="2"
                            fill="#22c55e"
                            stroke="#14532d"
                            stroke-width="1"
                        ></circle>
                    {/if}
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
