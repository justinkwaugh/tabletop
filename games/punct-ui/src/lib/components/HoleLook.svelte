<script lang="ts">
    import { BOARD_DEPTH, HOLE_RADIUS, VIEW } from '$lib/board/geometry.js'

    // A hole through the board's plate, round its centre, drawn live for the looks page alone (the
    // board shows it as an image, board/looks.ts): its far wall, in shade under the plate's top,
    // and below it the base, lit in the middle, seen through the hole.
    let { prefix }: { prefix: string } = $props()

    const ry = HOLE_RADIUS * VIEW.tilt
</script>

<defs>
    <linearGradient id="{prefix}-hole-wall" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#4b524e"></stop>
        <stop offset="0.6" stop-color="#7d857f"></stop>
    </linearGradient>
    <radialGradient id="{prefix}-hole-floor" cy="0.6">
        <stop offset="0.3" stop-color="#c6ccc8"></stop>
        <stop offset="1" stop-color="#8f9792"></stop>
    </radialGradient>
    <clipPath id="{prefix}-hole">
        <ellipse rx={HOLE_RADIUS} {ry}></ellipse>
    </clipPath>
</defs>
<ellipse rx={HOLE_RADIUS} {ry} fill="url(#{prefix}-hole-wall)"></ellipse>
<ellipse
    cy={VIEW.height(BOARD_DEPTH)}
    rx={HOLE_RADIUS}
    {ry}
    fill="url(#{prefix}-hole-floor)"
    clip-path="url(#{prefix}-hole)"
></ellipse>
