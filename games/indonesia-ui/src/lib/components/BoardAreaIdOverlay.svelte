<script lang="ts">
    import { LAND_MARKER_POSITIONS } from '$lib/definitions/landMarkerPositions.js'

    const areaLabels = Object.entries(LAND_MARKER_POSITIONS).map(([areaId, point]) => ({
        areaId,
        x: point.x,
        y: point.y
    }))
</script>

<g class="pointer-events-none select-none" aria-label="Board area id overlay">
    {#each areaLabels as label (label.areaId)}
        <text
            x={label.x}
            y={label.y}
            text-anchor="middle"
            dominant-baseline="central"
            font-size="20"
            font-weight="700"
            letter-spacing="0.04em"
            fill="#5c432b"
            stroke="#f7f0e7"
            stroke-width="5"
            stroke-linejoin="round"
            paint-order="stroke"
            opacity="0.92"
        >
            {label.areaId}
        </text>
    {/each}
</g>
