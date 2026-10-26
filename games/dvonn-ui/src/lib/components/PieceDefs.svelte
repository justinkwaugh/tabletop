<svelte:options namespace="svg" />

<script lang="ts">
    import { SHADE_LEVELS, sideStops, topStops } from '$lib/board/pieceShape.js'
    import type { Tone } from '$lib/board/pieceStyle.js'

    // Shared by every piece drawn in one SVG: each color's side and top shades, and the board in
    // the shadow under a stack.
    let { prefix, tones = ['white', 'black', 'red'] }: { prefix: string; tones?: readonly Tone[] } =
        $props()

    const levels = Array.from({ length: SHADE_LEVELS }, (_, level) => level)
    const used = $derived([...new Set(tones)])
</script>

{#each used as tone (tone)}
    {#each levels as level (level)}
        <linearGradient id="{prefix}-{tone}-side-{level}" x1="0" y1="0" x2="1" y2="0">
            {#each sideStops(tone, level) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.color}></stop>
            {/each}
        </linearGradient>
        <linearGradient id="{prefix}-{tone}-top-{level}" x1="0" y1="0" x2="0" y2="1">
            {#each topStops(tone, level) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.color}></stop>
            {/each}
        </linearGradient>
    {/each}
{/each}
<!-- Right under a stack, the board in its shadow, seen through the gap below it and down the
     hole. -->
<radialGradient id="{prefix}-contact">
    <stop offset="0" stop-color="rgb(0 0 0 / 0.55)"></stop>
    <stop offset="0.85" stop-color="rgb(0 0 0 / 0.45)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
