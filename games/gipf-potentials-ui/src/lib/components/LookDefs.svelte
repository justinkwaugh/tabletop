<svelte:options namespace="svg" />

<script lang="ts">
    import { SHADE_LEVELS, sideStops, TONES, wallColors } from '$lib/board/pieceShape.js'

    // What drawing a disc's look needs, for the looks page alone: the game shows the looks as
    // images, so none of this reaches it. The side's shades, and the grooves' walls.
    let { prefix }: { prefix: string } = $props()

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

<!-- A groove's walls: in shade on the far side, catching the light on the near side, fading to
     the groove's own colour at either end of the ring. -->
{#each TONES as tone (tone)}
    {@const { far, near } = wallColors(tone)}
    <linearGradient id="{prefix}-{tone}-far-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={far}></stop>
        <stop offset="0.5" stop-color={far} stop-opacity="0"></stop>
    </linearGradient>
    <linearGradient id="{prefix}-{tone}-near-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={near} stop-opacity="0"></stop>
        <stop offset="1" stop-color={near}></stop>
    </linearGradient>
{/each}
