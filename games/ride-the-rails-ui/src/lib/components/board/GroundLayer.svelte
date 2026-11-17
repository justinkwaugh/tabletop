<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCenter, hexPoints, pointText } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK, CITY_CENTRE_INSET, hexPaint } from '$lib/utils/boardLook.js'
    import { MOUNTAIN_PEAK } from '$lib/utils/cityMarks.js'
    import { insetCellPoints } from '$lib/utils/pickMarks.js'
    import {
        ALPS_HATCH,
        alpsHatchPath,
        ENTRY_RING,
        entryRingSides,
        BUFFER_STOP,
        bufferStopSpots
    } from '$lib/utils/terrainMarks.js'

    const gameSession = getGameSession()

    // Displayed Game State: the shown state's map, each hex one outline round its cells.
    const board = $derived(gameSession.boardFrame)
    const HEXES = $derived(
        board.map.hexes.map((hex) => ({
            hexId: hex.id,
            points: hexPoints(hex.id),
            center: hexCenter(hex.id),
            paint: hexPaint(hex.id),
            // R-8.2: the Alps carry a mountain's peak too.
            mountain: hex.terrain === 'mountain' || hex.terrain === 'alps',
            alps: hex.terrain === 'alps'
        }))
    )
    // Plains first, on their grid; mountains and cities over them, so their pale edges show whole.
    const PLAINS = $derived(HEXES.filter((hex) => hex.paint.edge === 'var(--rtr-hex-edge)'))
    const PATCHES = $derived(HEXES.filter((hex) => hex.paint.edge !== 'var(--rtr-hex-edge)'))
    const MOUNTAINS = $derived(HEXES.filter((hex) => hex.mountain))
    // R-8.2: the Alps' hatch over their fill, their pale edges drawn again over it; a buffer stop
    // in each long-distance hex and city (Perth, Brisbane), where a placement ends the turn.
    const ALPS = $derived(HEXES.filter((hex) => hex.alps))
    const ALPS_HATCH_PATH = $derived(alpsHatchPath(board))
    const BUFFER_STOPS = $derived(bufferStopSpots(board))
    // R-8.4: the ring of entry hexes round Paris, its outside edged in navy.
    const ENTRY_RING_PATH = $derived(
        entryRingSides(board)
            .map(({ from, to }) => `M${pointText(from)}L${pointText(to)}`)
            .join('')
    )
    // BOARD_LOOK.cityCentre 'cream-inset': every city's middle in the plains' cream, its grey a rim,
    // in each of its cells.
    const CITY_CENTRES = $derived(
        BOARD_LOOK.cityCentre === 'cream-inset'
            ? board.map.hexes
                  .filter((hex) => hex.terrain === 'city')
                  .flatMap((hex) =>
                      insetCellPoints(hex.id, CITY_CENTRE_INSET).map((points, cell) => ({
                          key: `${hex.id}:${cell}`,
                          points
                      }))
                  )
            : []
    )

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
    const { x, y, width, height } = $derived(board.extents)
    const HATCH_PATH = $derived(
        Array.from({ length: Math.ceil((width + height) / STEP) }, (_, index) => {
            const start = x + index * STEP
            return `M${start.toFixed(1)} ${y}l${-height} ${height}`
        }).join('')
    )
    // A mountain's mark: a small peak near the top of the hex (the frame's peakRise).
    const PEAK_RISE = $derived(board.hexFrame.peakRise)
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
    {#each CITY_CENTRES as city (city.key)}
        <polygon points={city.points} fill="var(--rtr-plain)" data-city-centre></polygon>
    {/each}
    {#if ALPS_HATCH_PATH}
        <path
            d={ALPS_HATCH_PATH}
            fill="none"
            stroke="var(--rtr-alps-hatch)"
            stroke-width={ALPS_HATCH.width}
            data-alps-hatch
        ></path>
        {#each ALPS as hex (hex.hexId)}
            <polygon
                points={hex.points}
                fill="none"
                stroke={hex.paint.edge}
                stroke-width={hex.paint.edgeWidth}
                stroke-linejoin="round"
            ></polygon>
        {/each}
    {/if}
    {#each MOUNTAINS as hex (hex.hexId)}
        <path
            d={MOUNTAIN_PEAK.path}
            transform="translate({hex.center.x} {hex.center.y -
                PEAK_RISE}) scale({MOUNTAIN_PEAK.scale})"
            fill="var(--rtr-mountain-ink)"
            aria-hidden="true"
        ></path>
    {/each}
    {#each BUFFER_STOPS as stop (stop.hexId)}
        <g transform="translate({stop.x} {stop.y})" data-buffer-stop={stop.hexId}>
            <path
                d={BUFFER_STOP.rails}
                fill="none"
                stroke="var(--rtr-ink)"
                stroke-width={BUFFER_STOP.railWidth}
                stroke-linecap="round"
            ></path>
            <path
                d={BUFFER_STOP.ties}
                fill="none"
                stroke="var(--rtr-ink)"
                stroke-width={BUFFER_STOP.tieWidth}
                stroke-linecap="round"
            ></path>
            <rect
                x={BUFFER_STOP.bar.x}
                y={BUFFER_STOP.bar.y}
                width={BUFFER_STOP.bar.width}
                height={BUFFER_STOP.bar.height}
                rx={BUFFER_STOP.bar.rx}
                fill="var(--rtr-impassable)"
                stroke="var(--rtr-ink)"
                stroke-width={BUFFER_STOP.barEdgeWidth}
            ></rect>
        </g>
    {/each}
    {#if ENTRY_RING_PATH}
        <path
            d={ENTRY_RING_PATH}
            fill="none"
            stroke="var(--rtr-pill)"
            stroke-width={ENTRY_RING.width}
            stroke-linecap="round"
            data-entry-ring
        ></path>
    {/if}
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
