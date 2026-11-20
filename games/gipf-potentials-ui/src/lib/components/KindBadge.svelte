<svelte:options namespace="svg" />

<script lang="ts">
    import type { BoardView } from '$lib/board/geometry.js'
    import { BADGE, badgeOffset, type BadgeSpot } from '$lib/board/badge.js'

    // A piece's kind on a badge on its top face, which is `face` above the piece's centre.
    let {
        letter,
        view,
        face,
        radius,
        spot = 'right'
    }: {
        letter: string
        view: BoardView
        face: number
        radius: number
        spot?: BadgeSpot
    } = $props()

    const at = $derived(badgeOffset(spot, radius, view.tilt))
    const fontSize = $derived(radius * BADGE.font * 10)
</script>

<g transform="translate({at.x} {face + at.y})" class="badge">
    <circle r={radius * BADGE.radius}></circle>
    <!-- Set ten times larger and scaled down: text this small is snapped to whole pixels, which
         pushed the letter off the badge's centre on phones. Its shift is in user units: Safari
         divides an SVG em length by the board's zoom. -->
    <text transform="scale(0.1)" font-size={fontSize} dy={0.36 * fontSize}>{letter}</text>
</g>

<style>
    .badge {
        pointer-events: none;
    }

    .badge circle {
        fill: #ffffff;
        stroke: #000000;
        stroke-width: 1.2;
    }

    .badge text {
        fill: #000000;
        font-weight: 700;
        text-anchor: middle;
    }
</style>
