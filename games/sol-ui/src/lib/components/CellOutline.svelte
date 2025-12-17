<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { coordinatesToNumber, OffsetCoordinates, sameCoordinates } from '@tabletop/common'
    import {
        dimensionsForSpace,
        getCirclePoint,
        RING_RADII,
        toRadians,
        translateFromCenter
    } from '$lib/utils/boardGeometry.js'
    import { CENTER_COORDS, Ring } from '@tabletop/sol'

    let { coords }: { coords: OffsetCoordinates } = $props()
    const gameSession = getContext('gameSession') as SolGameSession
    const dimensions = dimensionsForSpace(gameSession.numPlayers, coords)
    const isCenterCell = sameCoordinates(coords, CENTER_COORDS)

    function cellPath(
        innerRadius: number,
        outerRadius: number,
        startDegrees: number,
        endDegrees: number
    ) {
        const startAngle = toRadians(startDegrees)
        const endAngle = toRadians(endDegrees)
        const start = getCirclePoint(innerRadius, startAngle)
        const end = getCirclePoint(innerRadius, endAngle)
        const startOuter = getCirclePoint(outerRadius, startAngle)
        const endOuter = getCirclePoint(outerRadius, endAngle)
        return `M${start.x} ${start.y} L${startOuter.x} ${startOuter.y} A${outerRadius} ${outerRadius} 0 0 1 ${endOuter.x} ${endOuter.y} L${end.x} ${end.y} A${innerRadius} ${innerRadius} 0 0 0 ${start.x} ${start.y}Z`
    }
</script>

<g
    id={`cell-outline-${coordinatesToNumber(coords)}`}
    class="pointer-events-none"
    transform={translateFromCenter(0, 0)}
    stroke={gameSession.animating ? 'transparent' : 'white'}
    stroke-width={8}
>
    {#if isCenterCell}
        <circle r={RING_RADII[Ring.Center][1]} fill="transparent"></circle>
    {:else}
        <path
            d={cellPath(
                dimensions.innerRadius,
                dimensions.outerRadius,
                dimensions.startDegrees,
                dimensions.endDegrees
            )}
            fill="transparent"
        ></path>
    {/if}
</g>
