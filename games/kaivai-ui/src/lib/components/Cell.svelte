<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { Hex } from 'honeycomb-grid'
    import cultTile from '$lib/images/culttile.png'
    import { axialCoordinatesToNumber, Point } from '@tabletop/common'
    import { CellType } from '@tabletop/kaivai'

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let { hex, origin }: { hex: Hex; origin: Point } = $props()
    let cell = $derived(gameSession.gameState.board.cells[axialCoordinatesToNumber(hex)])
    let cellImage = $derived.by(() => {
        if (cell) {
            switch (cell.type) {
                case CellType.Cult:
                    return cultTile
                default:
                    return undefined
            }
        }
        return undefined
    })

    const corners = hex.corners
        .map(({ x, y }: { x: number; y: number }) => `${x + origin.x},${y + origin.y}`)
        .join(' ')
    console.log('corners', corners)
</script>

<g stroke="none" stroke-width="2" transform="translate({hex.x + origin.x}, {hex.y + origin.y})">
    <polygon points="25,-43.5 50,0 25,43.5 -25,43.5 -50,0 -25,-43.5" fill="none"></polygon>
    {#if cellImage}
        <g transform="rotate(30)">
            <image
                href={cellImage}
                x={-hex.height / 2}
                y={-hex.width / 2}
                width={hex.height}
                height={hex.width}
            ></image>
        </g>
    {/if}
</g>
