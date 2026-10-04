<script lang="ts">
    import { CastShadowFilterId } from '$lib/utils/boardGeometry.js'
    import { CobblePatternId } from '$lib/utils/cobbles.js'
    import { GateFloors, GatePillars, WallMortar } from '$lib/utils/cityWall.js'

    const CapInset = 5
    const ShadowOffset = { x: 3, y: 4 }
</script>

{#each GateFloors as floor (`${floor.x},${floor.y}`)}
    <rect
        x={floor.x}
        y={floor.y}
        width={floor.width}
        height={floor.height}
        fill="url(#{CobblePatternId})"
    ></rect>
{/each}
{#each GatePillars as pillar (`${pillar.x},${pillar.y}`)}
    <rect
        x={pillar.x + ShadowOffset.x}
        y={pillar.y + ShadowOffset.y}
        width={pillar.width}
        height={pillar.height}
        fill="#000000"
        opacity="0.35"
        filter="url(#{CastShadowFilterId})"
    ></rect>
    <rect
        x={pillar.x}
        y={pillar.y}
        width={pillar.width}
        height={pillar.height}
        rx="2"
        fill="#a07e55"
        stroke={WallMortar}
        stroke-width="1.5"
    ></rect>
    <rect
        x={pillar.x + CapInset}
        y={pillar.y + CapInset}
        width={pillar.width - 2 * CapInset}
        height={pillar.height - 2 * CapInset}
        rx="1.5"
        fill="#c4a274"
        stroke="#8a6a46"
        stroke-width="1"
    ></rect>
{/each}
