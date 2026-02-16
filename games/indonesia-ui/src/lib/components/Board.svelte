<script lang="ts">
    import boardImg from '$lib/images/indo_map_sm.jpg'
    import { LEFTMOST_ISLAND_AREAS, TOP_CENTER_ISLAND_AREAS } from '$lib/definitions/boardGeometry.js'

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
            labelY: (minY + maxY) / 2,
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

    const DEBUG_LEFTMOST_AREAS: DebugArea[] = LEFTMOST_ISLAND_AREAS.map((area) => ({
        ...area,
        label: getCompactAreaLabel(area.id),
        ...getPathLabelPosition(area.path),
    }))

    const DEBUG_BORNEO_AREAS: DebugArea[] = TOP_CENTER_ISLAND_AREAS.map((area) => ({
        ...area,
        label: getCompactAreaLabel(area.id),
        ...getPathLabelPosition(area.path),
    }))

    const DEBUG_MAP_AREAS: DebugArea[] = [...DEBUG_LEFTMOST_AREAS, ...DEBUG_BORNEO_AREAS]
</script>

<div class="board-shell">
    <div class="board-surface relative h-[1280px] w-[2646px]">
        <img src={boardImg} alt="Indonesia game board" class="board-image absolute inset-0 h-full w-full" />
        <svg
            class="absolute inset-0 z-[2] h-full w-full"
            viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
            aria-label="Indonesia board overlay"
        >
            {#if SHOW_DEBUG_GEOMETRY}
                <g class="pointer-events-none" aria-label="Debug map geometry">
                    {#each DEBUG_MAP_AREAS as area (area.id)}
                        <path
                            d={area.path}
                            fill="none"
                            stroke="#ff1e1e"
                            stroke-width="2.25"
                            stroke-linejoin="round"
                            stroke-linecap="round"
                            opacity="0.95"
                        />
                        <text
                            x={area.labelX}
                            y={area.labelY}
                            fill="#ff1e1e"
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
