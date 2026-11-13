<svelte:options namespace="svg" />

<script lang="ts">
    import { SHADE_LEVELS, sideStops, TONES, wallColors } from '$lib/board/pieceShape.js'

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
