<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { defineHex, Grid, ring, spiral, Orientation } from 'honeycomb-grid'
    import board from '$lib/images/board.png'
    import Cell from './Cell.svelte'
    import buildImg from '$lib/images/build.png'
    import moveImg from '$lib/images/move.png'
    import increaseImg from '$lib/images/increase.png'
    import celebrateImg from '$lib/images/celebrate.png'
    import fishImg from '$lib/images/fish.png'
    import deliverImg from '$lib/images/deliver.png'

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

    let origin = { x: xOffset, y: yOffset + 100 }
</script>

<div class="flex flex-col justify-center items-center p-2">
    <div class="relative mt-8 w-full fit-content">
        <div class="absolute top-[100px] left-0 w-full">
            <img class="w-[1200px]" src={board} alt="board" />
        </div>
        <div
            class="z-10"
            style="width:{grid.pixelWidth + 16 + 'px'};height:{grid.pixelHeight + 16 + 100 + 'px'};"
        >
            <svg
                transform="translate(7,-12) scale(1.005,.975)"
                width={Math.ceil(grid.pixelWidth)}
                height={Math.ceil(grid.pixelHeight) + 100}
            >
                <defs>
                    <filter id="dropshadow" height="130%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="10 10"></feGaussianBlur>
                        <!-- stdDeviation is how much to blur -->
                        <feOffset dx="50" dy="-20" result="offsetblur"></feOffset>
                        <!-- how much to offset -->
                        <feComponentTransfer>
                            <feFuncA type="linear" slope="0.5"></feFuncA>
                            <!-- slope is the opacity of the shadow -->
                        </feComponentTransfer>
                        <feMerge>
                            <feMergeNode></feMergeNode>
                            <!-- this contains the offset blurred image -->
                            <feMergeNode in="SourceGraphic"></feMergeNode>
                            <!-- this contains the element that the filter is applied to -->
                        </feMerge>
                    </filter>
                    <filter id="textshadow" width="130%" height="130%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="1 1" result="shadow"
                        ></feGaussianBlur>
                        <feOffset dx="3" dy="9"></feOffset>
                    </filter>
                </defs>

                <image href={moveImg} x={5} y={150} width={150} height={150}> </image>
                <circle cx={80} cy={225} r="75" fill="none" stroke="#634a11" stroke-width="4"
                ></circle>

                <image href={buildImg} x={85} y={5} width={150} height={150}> </image>
                <circle cx={160} cy={80} r="75" fill="none" stroke="#634a11" stroke-width="4"
                ></circle>

                <image href={increaseImg} x={250} y={5} width={150} height={150}> </image>
                <circle cx={325} cy={80} r="75" fill="none" stroke="#634a11" stroke-width="4"
                ></circle>

                <image href={deliverImg} x={845} y={150} width={150} height={150}> </image>
                <circle cx={920} cy={225} r="75" fill="none" stroke="#634a11" stroke-width="4"
                ></circle>

                <image href={fishImg} x={765} y={5} width={150} height={150}> </image>
                <circle cx={840} cy={80} r="75" fill="none" stroke="#634a11" stroke-width="4"
                ></circle>

                <image href={celebrateImg} x={600} y={5} width={150} height={150}> </image>
                <circle cx={675} cy={80} r="75" fill="none" stroke="#634a11" stroke-width="4"
                ></circle>

                {#each grid as hex}
                    <Cell {hex} {origin} />
                {/each}
            </svg>
        </div>
    </div>
</div>
