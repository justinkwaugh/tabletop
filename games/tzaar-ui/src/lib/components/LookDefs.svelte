<svelte:options namespace="svg" />

<script lang="ts">
    import { SHADE_LEVELS, sideStops, wallColors } from '$lib/board/pieceShape.js'
    import type { Surface } from '$lib/board/pieceStyle.js'

    // What drawing a piece's look needs, for the looks page alone: the game shows the looks as
    // images, so none of this reaches it. The side's shades, and the hollows' walls, plastic and
    // metal.
    let { prefix }: { prefix: string } = $props()

    const TONES = ['white', 'black'] as const
    const SURFACES: Surface[] = ['white', 'black', 'gold', 'silver']
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

<!-- The hollows' walls: in shade on the far side, catching the light on the near side, fading to
     the hollow's own colour at either end of the ring. -->
{#each SURFACES as surface (surface)}
    {@const { far, near } = wallColors(surface)}
    <linearGradient id="{prefix}-{surface}-far-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={far}></stop>
        <stop offset="0.5" stop-color={far} stop-opacity="0"></stop>
    </linearGradient>
    <linearGradient id="{prefix}-{surface}-near-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={near} stop-opacity="0"></stop>
        <stop offset="1" stop-color={near}></stop>
    </linearGradient>
{/each}
