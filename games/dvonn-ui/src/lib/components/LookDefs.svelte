<svelte:options namespace="svg" />

<script lang="ts">
    import {
        SHADE_LEVELS,
        sideStops,
        slopeColors,
        type DishShading
    } from '$lib/board/pieceShape.js'
    import type { Tone } from '$lib/board/pieceStyle.js'

    // What drawing a piece's look needs, for the looks page alone: the game shows the looks as
    // images, so none of this reaches it. The side's shades, and the top's slopes.
    let { prefix, shading }: { prefix: string; shading?: DishShading } = $props()

    const TONES: Tone[] = ['white', 'black', 'red']
    const levels = Array.from({ length: SHADE_LEVELS }, (_, level) => level)
</script>

{#each TONES as tone (tone)}
    {#each levels as level (level)}
        <linearGradient id="{prefix}-{tone}-side-{level}" x1="0" y1="0" x2="1" y2="0">
            {#each sideStops(tone, level) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.color}></stop>
            {/each}
        </linearGradient>
    {/each}
{/each}

<!-- The top's slopes: catching the light where they face you, in shade where they face away,
     strongest at the far edge of a band's far half and the near edge of its near half, fading
     to the band's own colour at the sides. -->
{#each TONES as tone (tone)}
    {@const colors = slopeColors(tone, shading)}
    {#each ['shade', 'light'] as const as kind (kind)}
        <linearGradient id="{prefix}-{tone}-far-{kind}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color={colors[kind]}></stop>
            <stop offset="0.5" stop-color={colors[kind]} stop-opacity="0"></stop>
        </linearGradient>
        <linearGradient id="{prefix}-{tone}-near-{kind}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color={colors[kind]} stop-opacity="0"></stop>
            <stop offset="1" stop-color={colors[kind]}></stop>
        </linearGradient>
    {/each}
{/each}
