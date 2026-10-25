<svelte:options namespace="svg" />

<script lang="ts">
    import { SHADE_LEVELS, sideStops, type Tone } from '$lib/board/pieceShape.js'

    // Shared by every piece drawn in one SVG: the side's shades, and each tone's top.
    let { prefix }: { prefix: string } = $props()

    const tones: Tone[] = ['light', 'dark']
    const levels = Array.from({ length: SHADE_LEVELS }, (_, level) => level)
</script>

{#each tones as tone (tone)}
    {#each levels as level (level)}
        <linearGradient id="{prefix}-{tone}-side-{level}" x1="0" y1="0" x2="1" y2="0">
            {#each sideStops(tone, level) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.color}></stop>
            {/each}
        </linearGradient>
    {/each}
{/each}

<!-- The top is flat: one gentle fall-off, so the centre and the edge round it read as level. -->
<radialGradient id="{prefix}-light-face" cx="0.42" cy="0.35" r="0.9">
    <stop offset="0" stop-color="#f4f0df"></stop>
    <stop offset="1" stop-color="#e8e1c7"></stop>
</radialGradient>
<radialGradient id="{prefix}-dark-face" cx="0.42" cy="0.35" r="0.9">
    <stop offset="0" stop-color="#34302f"></stop>
    <stop offset="1" stop-color="#232021"></stop>
</radialGradient>
<!-- Right under a piece, the board in its shadow, seen through the gap below it. -->
<radialGradient id="{prefix}-contact">
    <stop offset="0" stop-color="rgb(0 0 0 / 0.55)"></stop>
    <stop offset="0.85" stop-color="rgb(0 0 0 / 0.45)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
