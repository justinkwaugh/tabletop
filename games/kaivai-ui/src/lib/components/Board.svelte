<script lang="ts">
    import { getContext, onMount } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { defineHex, Grid, ring, spiral } from 'honeycomb-grid'
    import { SVG } from '@svgdotjs/svg.js'
    import { axialCoordinatesToNumber } from '@tabletop/common'

    let gameSession = getContext('gameSession') as KaivaiGameSession
    const Hex = defineHex({ dimensions: 50 })
    const spiralTraverser = spiral({ radius: 6, start: [0, 0] })
    const grid = new Grid(Hex, spiralTraverser)
    const yOffset = grid.pixelHeight / 2
    const xOffset = grid.pixelWidth / 2

    onMount(() => {
        const draw = SVG().addTo('#abc').size('100%', '100%')
        grid.forEach(renderSVG)

        function renderSVG(hex: Hex) {
            const populated = gameSession.gameState.board.cells[axialCoordinatesToNumber(hex)]
            const polygon = draw
                // create a polygon from a hex's corner points
                .polygon(
                    hex.corners.map(
                        ({ x, y }: { x: number; y: number }) => `${x + xOffset},${y + yOffset}`
                    )
                )
                .fill(populated ? '#FF0000' : 'none')
                .stroke({ width: 1, color: '#FFFFFF' })

            const coords = draw
                .text(`${hex.q},${hex.r}`)
                .stroke('#FFFFFF')
                .dx(hex.x - 25 + xOffset)
                .dy(hex.y + yOffset)

            return draw.group().add(polygon).add(coords)
        }
    })
</script>

<div
    class="relative flex justify-center items-center"
    style="width:{grid.pixelWidth + 2 + 'px'};height:{grid.pixelHeight + 2 + 'px'};"
>
    <div class="w-full h-full" id="abc"></div>
</div>
