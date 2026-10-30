<svelte:options namespace="svg" />

<script lang="ts">
    import { PIECE_RADIUS, SHADOW_BLUR, type BoardView } from '$lib/board/geometry.js'
    import { DISC_LOOKS, SHADE_LEVELS, sideStops, TONES, type Disc } from '$lib/board/pieceShape.js'
    import DiscLook from './DiscLook.svelte'

    // Shared by every piece drawn in one SVG: the side's shades, each tone's top, the shadows, and
    // the look of any disc given, at one radius, for drawing it live (as the looks page does).
    let {
        prefix,
        radius,
        view,
        looks = []
    }: { prefix: string; radius: number; view: BoardView; looks?: readonly Disc[] } = $props()

    const tones = TONES
    const SHADOW_SOLID = (PIECE_RADIUS - SHADOW_BLUR) / (PIECE_RADIUS + SHADOW_BLUR)
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
<!-- A groove's walls: in shade on the far side, catching the light on the near side, fading to
     the groove's own colour at either end of the ring. -->
<linearGradient id="{prefix}-light-far-wall" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#aca280"></stop>
    <stop offset="0.5" stop-color="#aca280" stop-opacity="0"></stop>
</linearGradient>
<linearGradient id="{prefix}-light-near-wall" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#e2dbc2" stop-opacity="0"></stop>
    <stop offset="1" stop-color="#e2dbc2"></stop>
</linearGradient>
<linearGradient id="{prefix}-dark-far-wall" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#080707"></stop>
    <stop offset="0.5" stop-color="#080707" stop-opacity="0"></stop>
</linearGradient>
<linearGradient id="{prefix}-dark-near-wall" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4a4446" stop-opacity="0"></stop>
    <stop offset="1" stop-color="#4a4446"></stop>
</linearGradient>
<!-- Right under a piece, the board in its shadow, seen through the gap below it. -->
<!-- A piece's soft shadow on the board, as a gradient rather than a blur, which is slow to paint
     on phones. -->
<radialGradient id="{prefix}-shadow">
    <stop offset="0" stop-color="rgb(0 0 0 / 0.3)"></stop>
    <stop offset={SHADOW_SOLID} stop-color="rgb(0 0 0 / 0.27)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
<radialGradient id="{prefix}-contact">
    <stop offset="0" stop-color="rgb(0 0 0 / 0.55)"></stop>
    <stop offset="0.85" stop-color="rgb(0 0 0 / 0.45)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
{#each looks as disc (`${disc.tone}-${disc.kind}`)}
    <DiscLook {disc} {radius} {prefix} {view} />
{/each}
