<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { defineHex, Grid, ring, spiral, Orientation } from 'honeycomb-grid'
    import board from '$lib/images/board.png'
    import Cell from './Cell.svelte'
    import { ActionType } from '@tabletop/kaivai'
    import BidBoard from '$lib/components/BidBoard.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession

    const Hex = defineHex({
        dimensions: { width: 100, height: 87 },
        orientation: Orientation.FLAT
    })

    const temp = new Hex({ q: 0, r: 0 })
    console.log(temp.corners)

    const spiralTraverser = spiral({ radius: 6, start: [0, 0] })
    const grid = new Grid(Hex, spiralTraverser)
    const yOffset = grid.pixelHeight / 2
    const xOffset = grid.pixelWidth / 2

    let origin = { x: xOffset, y: yOffset }
</script>

<div class="flex flex-col justify-center items-center p-2">
    <div class="relative mt-8 w-full fit-content">
        <div class="absolute top-0 left-0 w-full">
            <img class="w-[1200px]" src={board} alt="board" />
        </div>
        <div
            class="z-10"
            style="width:{grid.pixelWidth + 16 + 'px'};height:{grid.pixelHeight + 16 + 'px'};"
        >
            <svg
                transform="translate(7,-12) scale(1.005,.975)"
                width={Math.ceil(grid.pixelWidth)}
                height={Math.ceil(grid.pixelHeight)}
            >
                {#each grid as hex}
                    <Cell {hex} {origin} />
                {/each}
            </svg>
        </div>
    </div>
</div>
