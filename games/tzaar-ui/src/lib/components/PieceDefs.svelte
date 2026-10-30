<svelte:options namespace="svg" />

<script lang="ts">
    import { farStops, nearStops, SHADE_LEVELS, sideStops } from '$lib/board/pieceShape.js'
    import { metalOf, type Surface, type Tone } from '$lib/board/pieceStyle.js'

    // Shared by every piece drawn in one SVG: each color's side shades and its top's, plastic and
    // metal, and the board in the shadow under a stack.
    let { prefix, tones = ['white', 'black'] }: { prefix: string; tones?: readonly Tone[] } =
        $props()

    const levels = Array.from({ length: SHADE_LEVELS }, (_, level) => level)
    const plastics = $derived([...new Set(tones)])
    const surfaces: Surface[] = $derived([...plastics, ...plastics.map(metalOf)])
</script>

{#each plastics as tone (tone)}
    {#each levels as level (level)}
        <linearGradient id="{prefix}-{tone}-side-{level}" x1="0" y1="0" x2="1" y2="0">
            {#each sideStops(tone, level) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.color}></stop>
            {/each}
        </linearGradient>
    {/each}
{/each}
{#each surfaces as surface (surface)}
    {#each levels as level (level)}
        <linearGradient id="{prefix}-{surface}-far-{level}" x1="0" y1="0" x2="0" y2="1">
            {#each farStops(surface, level) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.color}></stop>
            {/each}
        </linearGradient>
        <linearGradient id="{prefix}-{surface}-near-{level}" x1="0" y1="0" x2="0" y2="1">
            {#each nearStops(surface, level) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.color}></stop>
            {/each}
        </linearGradient>
    {/each}
{/each}
<!-- Right under a stack, the board in its shadow, seen through the gap below it. -->
<radialGradient id="{prefix}-contact">
    <stop offset="0" stop-color="rgb(0 0 0 / 0.55)"></stop>
    <stop offset="0.85" stop-color="rgb(0 0 0 / 0.45)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
