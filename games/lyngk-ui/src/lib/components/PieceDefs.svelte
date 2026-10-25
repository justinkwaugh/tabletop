<svelte:options namespace="svg" />

<script lang="ts">
    import { PieceColor } from '@tabletop/lyngk'
    import { faceStops, SHADE_LEVELS, sideStops } from '$lib/board/pieceShape.js'

    // Shared by every piece drawn in one SVG: each color's side shades and top, and the shadow.
    let {
        prefix,
        colors = Object.values(PieceColor)
    }: { prefix: string; colors?: readonly PieceColor[] } = $props()

    const levels = Array.from({ length: SHADE_LEVELS }, (_, level) => level)
    const used = $derived([...new Set(colors)])
</script>

{#each used as color (color)}
    {#each levels as level (level)}
        <linearGradient id="{prefix}-{color}-side-{level}" x1="0" y1="0" x2="1" y2="0">
            {#each sideStops(color, level) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.color}></stop>
            {/each}
        </linearGradient>
    {/each}
    <radialGradient id="{prefix}-{color}-face" cx="0.42" cy="0.35" r="0.9">
        {#each faceStops(color) as stop (stop.offset)}
            <stop offset={stop.offset} stop-color={stop.color}></stop>
        {/each}
    </radialGradient>
{/each}
<!-- Right under the disc, the board in its shadow, seen through the gap below it. -->
<radialGradient id="{prefix}-contact">
    <stop offset="0" stop-color="rgb(0 0 0 / 0.55)"></stop>
    <stop offset="0.85" stop-color="rgb(0 0 0 / 0.45)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
<radialGradient id="{prefix}-shadow">
    <stop offset="0.55" stop-color="rgb(0 0 0 / 0.32)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
