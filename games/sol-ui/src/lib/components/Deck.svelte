<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import type { Point } from '@tabletop/common'
    import CardBack from '$lib/images/cardBack2.png'

    let {
        width = 35,
        height = 50,
        location = { x: 0, y: 0 }
    }: {
        width?: number
        height?: number
        location?: Point
    } = $props()
    let gameSession = getContext('gameSession') as SolGameSession
</script>

<g transform={`translate(${location.x}, ${location.y})`}>
    {#each { length: 3 } as _, index (index)}
        <rect
            rx="10"
            ry="10"
            width={width - 2}
            height={height - 2}
            x={1 + (3 - index) * 3}
            y={1 + (3 - index) * 3}
            fill="#000000"
            stroke="#5a5141"
            stroke-width="2"
        ></rect>
    {/each}

    <image xlink:href={CardBack} {width} {height} clip-path="inset(0% round 10px)"></image>
    <rect
        rx="10"
        ry="10"
        width={width - 2}
        height={height - 2}
        x="1"
        y="1"
        fill="none"
        stroke="#5a5141"
        stroke-width="2"
    ></rect>
    <text
        x={width / 2 + 5}
        y={height + 40}
        text-anchor="middle"
        font-family="metropolis, sans-serif"
        font-size={30}
        font-weight="bold"
        fill="#ad9c80"
        stroke="#000000">{gameSession.gameState.deck.remaining}</text
    >
</g>
