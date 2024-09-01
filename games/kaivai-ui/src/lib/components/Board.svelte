<script lang="ts">
    import { getContext, onMount } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { defineHex, Grid, ring, spiral } from 'honeycomb-grid'
    import { SVG } from '@svgdotjs/svg.js'
    import cultTile from '$lib/images/culttile.png'
    import { axialCoordinatesToNumber } from '@tabletop/common'
    import Cell from './Cell.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession

    const Hex = defineHex({ dimensions: { height: 100, width: 87 } })

    const spiralTraverser = spiral({ radius: 6, start: [0, 0] })
    const grid = new Grid(Hex, spiralTraverser)
    const yOffset = grid.pixelHeight / 2
    const xOffset = grid.pixelWidth / 2

    let origin = { x: xOffset, y: yOffset }
</script>

<div
    class="relative flex justify-center items-center p-2"
    style="width:{grid.pixelWidth + 16 + 'px'};height:{grid.pixelHeight + 16 + 'px'};"
>
    <svg width={Math.ceil(grid.pixelWidth)} height={Math.ceil(grid.pixelHeight)}>
        {#each grid as hex}
            <Cell {hex} {origin} />
        {/each}
    </svg>
</div>
