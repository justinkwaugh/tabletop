<svelte:options namespace="svg" />

<script lang="ts">
    import { PieceColor } from '@tabletop/lyngk'
    import { SHADE_LEVELS, sideStops, wallColors } from '$lib/board/pieceShape.js'

    // What drawing a disc's look needs, for the looks page alone: the game shows the looks as
    // images, so none of this reaches it. The side's shades, and the groove's walls. The specks'
    // clips come from a PieceDefs beside it.
    let { prefix }: { prefix: string } = $props()

    const COLORS = Object.values(PieceColor)
    const levels = Array.from({ length: SHADE_LEVELS }, (_, level) => level)
</script>

{#each COLORS as color (color)}
    {#each levels as level (level)}
        <linearGradient id="{prefix}-{color}-side-{level}" x1="0" y1="0" x2="1" y2="0">
            {#each sideStops(color, level) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.color}></stop>
            {/each}
        </linearGradient>
    {/each}
{/each}

<!-- The groove's walls: in shade on the far side, catching the light on the near side, fading to
     the groove's own colour at either end of the ring. -->
{#each COLORS as color (color)}
    {@const { far, near } = wallColors(color)}
    <linearGradient id="{prefix}-{color}-far-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={far}></stop>
        <stop offset="0.5" stop-color={far} stop-opacity="0"></stop>
    </linearGradient>
    <linearGradient id="{prefix}-{color}-near-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={near} stop-opacity="0"></stop>
        <stop offset="1" stop-color={near}></stop>
    </linearGradient>
{/each}
