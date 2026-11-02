<script lang="ts">
    import { PIECE_THICKNESS, PUNCT_RADIUS, SPACING, VIEW } from '$lib/board/geometry.js'
    import type { Tone } from '$lib/board/pieceShape.js'

    // The rulebook's PÜNCT-piece: a round marker with one dot, standing where a moving piece's
    // PÜNCT was, so its lines of travel can be seen.
    let { tone }: { tone: Tone } = $props()

    const view = VIEW
    const radius = SPACING * 0.33
    const rise = view.height(PIECE_THICKNESS * 0.8)
    const ry = radius * view.tilt
</script>

<g class="marker {tone}">
    <ellipse rx={radius + 2} ry={ry + 2} class="shadow"></ellipse>
    <path
        d="M {-radius} {-rise} L {-radius} 0 A {radius} {ry} 0 0 0 {radius} 0 L {radius} {-rise} Z"
        class="side"
    ></path>
    <ellipse cy={-rise} rx={radius} {ry} class="top"></ellipse>
    <ellipse cy={-rise} rx={PUNCT_RADIUS * 0.8} ry={PUNCT_RADIUS * 0.8 * view.tilt} class="dot"
    ></ellipse>
</g>

<style>
    .shadow {
        fill: rgb(20 30 25 / 0.25);
    }

    .light .side {
        fill: #b3b9c3;
    }

    .light .top {
        fill: #e2e6ec;
        stroke: #a7aeb8;
        stroke-width: 0.8;
    }

    .light .dot {
        fill: #fbfbf9;
        stroke: #a7aeb8;
    }

    .dark .side {
        fill: #141618;
    }

    .dark .top {
        fill: #2c3034;
        stroke: #0b0c0d;
        stroke-width: 0.8;
    }

    .dark .dot {
        fill: #111315;
        stroke: #4d545b;
    }
</style>
