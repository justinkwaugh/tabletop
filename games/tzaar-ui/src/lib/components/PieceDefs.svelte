<svelte:options namespace="svg" />

<script lang="ts">
    import { PIECE_RADIUS } from '$lib/board/pieceGeometry.js'
    import { SHADE_LEVELS, sideStops } from '$lib/board/pieceShape.js'
    import { speckClips } from '$lib/board/specks.js'

    // Shared by every piece drawn in one SVG at one radius: a thinned piece's side, the board in
    // the shadow under a stack, and the clips that keep a piece's specks on it. Whole pieces are
    // pre-rendered images (board/looks.ts).
    let { prefix, radius = PIECE_RADIUS }: { prefix: string; radius?: number } = $props()

    const MID_LEVEL = (SHADE_LEVELS - 1) / 2
    const clips = $derived(speckClips(radius))
</script>

{#each ['white', 'black'] as const as tone (tone)}
    <linearGradient id="{prefix}-{tone}-side-{MID_LEVEL}" x1="0" y1="0" x2="1" y2="0">
        {#each sideStops(tone, MID_LEVEL) as stop (stop.offset)}
            <stop offset={stop.offset} stop-color={stop.color}></stop>
        {/each}
    </linearGradient>
{/each}
<!-- Right under a stack, the board in its shadow, seen through the gap below it. -->
<radialGradient id="{prefix}-contact">
    <stop offset="0" stop-color="rgb(0 0 0 / 0.55)"></stop>
    <stop offset="0.85" stop-color="rgb(0 0 0 / 0.45)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
<!-- Each piece's specks, kept on it: in its own coordinates, from its underside. -->
<clipPath id="{prefix}-top-clip">
    <path d={clips.top}></path>
</clipPath>
<clipPath id="{prefix}-side-clip">
    <path d={clips.side} clip-rule="evenodd"></path>
</clipPath>
