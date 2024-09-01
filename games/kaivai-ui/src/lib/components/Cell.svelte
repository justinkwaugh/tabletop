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
</script>

<g stroke="black" stroke-width="2">
    <polygon
        points={hex.corners
            .map(({ x, y }: { x: number; y: number }) => `${x + origin.x},${y + origin.y}`)
            .join(' ')}
        fill="#4592be"
    ></polygon>
    {#if cellImage}
        <image
            href={cellImage}
            x={hex.x - hex.width / 2 + origin.x}
            y={hex.y - hex.height / 2 + origin.y}
            width={hex.width}
            height={hex.height}
        ></image>
    {/if}
</g>
