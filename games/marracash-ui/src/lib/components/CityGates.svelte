<script lang="ts">
    import { CastShadowFilterId } from '$lib/utils/boardGeometry.js'
    import {
        GateFloors,
        PillarShadowOffset,
        RammedEarthPatternId,
        Towers,
        towerMerlons,
        WallMortar,
        WallStoneFilterId
    } from '$lib/utils/cityWall.js'

    let { groundFill }: { groundFill: string } = $props()

    const GatewayShade = 0.18
</script>

{#each GateFloors as floor (`${floor.x},${floor.y}`)}
    <rect x={floor.x} y={floor.y} width={floor.width} height={floor.height} fill={groundFill}
    ></rect>
    <rect
        x={floor.x}
        y={floor.y}
        width={floor.width}
        height={floor.height}
        fill={WallMortar}
        opacity={GatewayShade}
    ></rect>
{/each}
{#each Towers as tower (`${tower.x},${tower.y}`)}
    <rect
        x={tower.x + PillarShadowOffset.x}
        y={tower.y + PillarShadowOffset.y}
        width={tower.width}
        height={tower.height}
        fill="#000000"
        opacity="0.3"
        filter="url(#{CastShadowFilterId})"
    ></rect>
    <rect
        x={tower.x}
        y={tower.y}
        width={tower.width}
        height={tower.height}
        rx="1.5"
        fill="url(#{RammedEarthPatternId})"
        stroke={WallMortar}
        stroke-width="1"
    ></rect>
    <g filter="url(#{WallStoneFilterId})" fill="url(#{RammedEarthPatternId}-raised)">
        {#each towerMerlons(tower) as merlon (`${merlon.x},${merlon.y}`)}
            <rect x={merlon.x} y={merlon.y} width={merlon.width} height={merlon.height} rx="1"
            ></rect>
        {/each}
    </g>
{/each}
