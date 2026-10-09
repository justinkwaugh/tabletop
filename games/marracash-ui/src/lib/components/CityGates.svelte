<script lang="ts">
    import {
        GateFloors,
        PillarShadowOffset,
        Towers,
        TowerBattlements,
        WallMortar,
        WallWalkway
    } from '$lib/utils/cityWall.js'
    import Battlements from '$lib/components/Battlements.svelte'

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
    ></rect>
    <rect
        x={tower.x}
        y={tower.y}
        width={tower.width}
        height={tower.height}
        rx="1.5"
        fill={WallWalkway}
        stroke={WallMortar}
        stroke-width="1"
    ></rect>
{/each}
<Battlements paths={TowerBattlements} />
