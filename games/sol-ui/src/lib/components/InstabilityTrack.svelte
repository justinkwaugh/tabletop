<script lang="ts">
import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import type { Point } from '@tabletop/common'
    import InstabilityMarker from '$lib/images/instability.svelte'
    import { InstabilityAnimator } from '$lib/animators/instabilityAnimator.js'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let {
        width = 840,
        height = 60,
        location = { x: 0, y: 0 }
    }: {
        width?: number
        height?: number
        location?: Point
    } = $props()
    let gameSession = getGameSession() as SolGameSession

    let cellWidth = width / 14
    let markerWidth = cellWidth * 0.45
    let markerHeight = markerWidth * 1.72

    let markerX = $derived.by(() => {
        const instability = gameSession.gameState.instability
        return (13 - instability) * cellWidth + (cellWidth - markerWidth) / 2
    })

    let bgColors = [
        '#db5439',
        '#de6538',
        '#edac55',
        '#f5ca57',
        '#f6d456',
        '#fade62',
        '#fdf38f',
        '#fcf2ad',
        '#fdf8c8',
        '#fcf4c8',
        '#fcf6d2',
        '#fefce0',
        '#fdfaf3',

        '#000000'
    ]

    const animator = new InstabilityAnimator(gameSession, cellWidth, markerWidth)
</script>

<g transform={`translate(${location.x}, ${location.y})`}>
    {#each { length: 14 } as _, index (index)}
        <rect
            x={index * cellWidth}
            y={0}
            width={cellWidth}
            {height}
            fill={bgColors[index]}
            stroke="#000000"
            stroke-width="2"
            opacity="0.4"
        ></rect>
        <text
            x={index * cellWidth + cellWidth / 2}
            y={height / 2 + 2}
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="16"
            font-weight="bold"
            fill={index === 13 ? '#ad9c80' : '#000000'}
        >
            {13 - index}
        </text>
    {/each}
    <rect x={0} y={0} {width} {height} fill="none" stroke="#3f392e" stroke-width="2"></rect>
    <InstabilityMarker
        width={markerWidth}
        height={markerHeight}
        x={markerX}
        y={-(height / 2) + 2}
        {animator}
    />
</g>
