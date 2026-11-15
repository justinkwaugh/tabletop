<script lang="ts">
    import { USA_HEXES } from '@tabletop/ride-the-rails'
    import { BOARD_EXTENTS, hexCenter, hexPoints } from '$lib/utils/boardGeometry.js'
    import { hexPaint } from '$lib/utils/boardLook.js'

    const HEXES = USA_HEXES.map((hex) => ({
        hexId: hex.id,
        points: hexPoints(hex.id),
        center: hexCenter(hex.id),
        paint: hexPaint(hex.id),
        mountain: hex.terrain === 'mountain'
    }))
    // Plains first, on their grid; mountains and cities over them, so their pale edges show whole.
    const PLAINS = HEXES.filter((hex) => hex.paint.edge === 'var(--rtr-hex-edge)')
    const PATCHES = HEXES.filter((hex) => hex.paint.edge !== 'var(--rtr-hex-edge)')
    const MOUNTAINS = HEXES.filter((hex) => hex.mountain)

    // Art plan, Board: a 45° hatch on the sea, and a navy frame just inside the board's edge. The
    // hatch is one path of lines 7 apart: a pattern fill of the same lines doubled the board's
    // repaint time in WebKit (docs/phone-rendering.md), the path costs nothing measurable.
    const HATCH = { size: 7, width: 1.5 }
    const FRAME = { inset: 4, width: 8, radius: 12 }
    const STEP = HATCH.size * Math.SQRT2
    const { x, y, width, height } = BOARD_EXTENTS
    const HATCH_PATH = Array.from({ length: Math.ceil((width + height) / STEP) }, (_, index) => {
        const start = x + index * STEP
        return `M${start.toFixed(1)} ${y}l${-height} ${height}`
    }).join('')
    // A mountain's mark: a small peak near the top of the hex, its base this far above the centre.
    const PEAK = 'M-9 0 L-3 -8 L1 -3 L4 -6 L9 0 Z'
    const PEAK_RISE = 22.8
    const PEAK_SCALE = 1.1
</script>

<g class="ground">
    <rect
        x={BOARD_EXTENTS.x}
        y={BOARD_EXTENTS.y}
        width={BOARD_EXTENTS.width}
        height={BOARD_EXTENTS.height}
        fill="var(--rtr-sea)"
        data-sea
    ></rect>
    <path
        d={HATCH_PATH}
        fill="none"
        stroke="var(--rtr-sea-line)"
        stroke-width={HATCH.width}
        data-sea-hatch
    ></path>
    {#each PLAINS as hex (hex.hexId)}
        <polygon
            points={hex.points}
            fill={hex.paint.fill}
            stroke={hex.paint.edge}
            stroke-width={hex.paint.edgeWidth}
        ></polygon>
    {/each}
    {#each PATCHES as hex (hex.hexId)}
        <polygon
            points={hex.points}
            fill={hex.paint.fill}
            stroke={hex.paint.edge}
            stroke-width={hex.paint.edgeWidth}
            stroke-linejoin="round"
        ></polygon>
    {/each}
    {#each MOUNTAINS as hex (hex.hexId)}
        <path
            d={PEAK}
            transform="translate({hex.center.x} {hex.center.y - PEAK_RISE}) scale({PEAK_SCALE})"
            fill="var(--rtr-mountain-ink)"
            aria-hidden="true"
        ></path>
    {/each}
    <rect
        x={BOARD_EXTENTS.x + FRAME.inset}
        y={BOARD_EXTENTS.y + FRAME.inset}
        width={BOARD_EXTENTS.width - 2 * FRAME.inset}
        height={BOARD_EXTENTS.height - 2 * FRAME.inset}
        rx={FRAME.radius}
        fill="none"
        stroke="var(--rtr-frame)"
        stroke-width={FRAME.width}
        data-frame
    ></rect>
</g>
