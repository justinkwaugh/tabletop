<script lang="ts">
    import { BADGE, badgeOffset, type BadgeSpot } from '$lib/board/badgeSpot.js'

    // A stack's height on a badge on its top piece, TZAAR's size, drawn over the stack's
    // selection ring. `top` is the height of the top piece's face, from the stack's space.
    let {
        height,
        spot,
        top,
        radius
    }: { height: number; spot: BadgeSpot; top: number; radius: number } = $props()

    const at = $derived(badgeOffset(spot, radius))
</script>

<g transform="translate({at.x} {top + at.y})" class="badge">
    <circle r={radius * BADGE.radius}></circle>
    <!-- Set ten times larger and scaled down: text this small is snapped to whole pixels, which
         pushed the digits off the badge's centre on phones. -->
    <text transform="scale(0.1)" font-size={radius * BADGE.font * 10} dy="0.36em">{height}</text>
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
        font-variant-numeric: tabular-nums;
    }
</style>
