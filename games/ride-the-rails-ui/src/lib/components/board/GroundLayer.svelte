<script lang="ts">
    import { USA_HEXES } from '@tabletop/ride-the-rails'
    import { BOARD_EXTENTS, hexCenter, hexPoints } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK, CITY_CENTRE_INSET, hexPaint } from '$lib/utils/boardLook.js'
    import { insetHexPoints } from '$lib/utils/pickMarks.js'

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
    // BOARD_LOOK.cityCentre 'cream-inset': every city's middle in the plains' cream, its grey a rim.
    const CITY_CENTRES =
        BOARD_LOOK.cityCentre === 'cream-inset'
            ? USA_HEXES.filter((hex) => hex.terrain === 'city').map((hex) => ({
                  hexId: hex.id,
                  points: insetHexPoints(hex.id, CITY_CENTRE_INSET)
              }))
            : []

    // Art plan, Board: a 45° hatch on the sea, and a navy frame just inside the board's edge. The
    // hatch is one path of lines 7 apart: a pattern fill of the same lines doubled the board's
    // repaint time in WebKit (docs/phone-rendering.md), the path costs nothing measurable.
    const HATCH = { size: 7, width: 1.5 }
    // The sea is a rounded card, so nothing pokes past its corners; the frame (BOARD_LOOK.mapFrame)
    // is a line just inside its edge, its outside on the sea's.
    const SEA_RADIUS = 16
    const FRAMES = {
        navy: { width: 8, stroke: 'var(--rtr-frame)' },
        'navy-thin': { width: 3, stroke: 'var(--rtr-frame)' },
        'sea-line': { width: 3, stroke: 'var(--rtr-sea-edge)' },
        none: undefined
    } as const
    const FRAME = FRAMES[BOARD_LOOK.mapFrame]
    // One per board drawn, so a second board (full screen) never clips by the first's id.
    const uid = $props.id()
    const SEA_CLIP_ID = `rtr-sea-clip-${uid}`
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
    <defs>
        <clipPath id={SEA_CLIP_ID}>
            <rect {x} {y} {width} {height} rx={SEA_RADIUS}></rect>
        </clipPath>
    </defs>
    <rect {x} {y} {width} {height} rx={SEA_RADIUS} fill="var(--rtr-sea)" data-sea></rect>
    <path
        d={HATCH_PATH}
        fill="none"
        stroke="var(--rtr-sea-line)"
        stroke-width={HATCH.width}
        clip-path="url(#{SEA_CLIP_ID})"
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
    {#each CITY_CENTRES as city (city.hexId)}
        <polygon points={city.points} fill="var(--rtr-plain)" data-city-centre></polygon>
    {/each}
    {#each MOUNTAINS as hex (hex.hexId)}
        <path
            d={PEAK}
            transform="translate({hex.center.x} {hex.center.y - PEAK_RISE}) scale({PEAK_SCALE})"
            fill="var(--rtr-mountain-ink)"
            aria-hidden="true"
        ></path>
    {/each}
    {#if FRAME}
        <rect
            x={x + FRAME.width / 2}
            y={y + FRAME.width / 2}
            width={width - FRAME.width}
            height={height - FRAME.width}
            rx={SEA_RADIUS - FRAME.width / 2}
            fill="none"
            stroke={FRAME.stroke}
            stroke-width={FRAME.width}
            data-frame
        ></rect>
    {/if}
</g>
