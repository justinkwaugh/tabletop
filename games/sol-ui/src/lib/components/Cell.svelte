<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import type { OffsetCoordinates } from '@tabletop/common'
    import {
        dimensionsForSpace,
        getCirclePoint,
        toRadians,
        translateFromCenter
    } from '$lib/utils/boardGeometry.js'

    let { coords }: { coords: OffsetCoordinates } = $props()
    let gameSession = getContext('gameSession') as SolGameSession

    let dimensions = dimensionsForSpace(5, coords) //gameSession.numPlayers, coords)
    let disabled = $derived.by(() => {
        return false
    })

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

{#if disabled}
    <g transform={translateFromCenter(0, 0)} stroke="none">
        <path
            d={cellPath(
                dimensions.innerRadius,
                dimensions.outerRadius,
                dimensions.startDegrees,
                dimensions.endDegrees
            )}
            opacity="0.5"
            fill="black"
        ></path>
    </g>
{/if}
