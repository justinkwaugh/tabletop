<script lang="ts">
    import { USA_HEXES, railroadsIn } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOARD_EXTENTS, COAST_PATH, hexCenter, hexPoints } from '$lib/utils/boardGeometry.js'
    import { hexPaint } from '$lib/utils/boardLook.js'
    import { insetHexPoints } from '$lib/utils/pickMarks.js'

    const gameSession = getGameSession()

    // A tinted city's rim sits just inside its edge (BOARD_LOOK.hexFill).
    const RIM_INSET = 2.6

    const HEXES = USA_HEXES.map((hex) => {
        const paint = hexPaint(hex.id)
        return {
            hexId: hex.id,
            mountain: hex.terrain === 'mountain',
            points: hexPoints(hex.id),
            center: hexCenter(hex.id),
            paint,
            rimPoints: paint.rim ? insetHexPoints(hex.id, RIM_INSET) : undefined
        }
    })
    const RIMMED = HEXES.filter((hex) => hex.rimPoints !== undefined)
    const MOUNTAINS = HEXES.filter((hex) => hex.mountain)

    // A mountain glyph moves up and shrinks out of the way once a cube stands in the hex.
    const GLYPH_RISE = 21
    const OCCUPIED_GLYPH_SCALE = 0.62
</script>

<g class="ground">
    <rect
        x={BOARD_EXTENTS.x}
        y={BOARD_EXTENTS.y}
        width={BOARD_EXTENTS.width}
        height={BOARD_EXTENTS.height}
        fill="var(--rtr-sea)"
    ></rect>
    <!-- The pale shelf along the coast: a wide stroke whose inner half the hexes cover. -->
    <path
        d={COAST_PATH}
        fill="none"
        stroke="var(--rtr-sea-shelf)"
        stroke-width="22"
        stroke-linejoin="round"
    ></path>
    {#each HEXES as hex (hex.hexId)}
        <polygon
            points={hex.points}
            fill={hex.paint.fill}
            stroke="var(--rtr-hex-edge)"
            stroke-width="1.6"
        ></polygon>
    {/each}
    {#each RIMMED as hex (hex.hexId)}
        <polygon
            points={hex.rimPoints}
            fill="none"
            stroke={hex.paint.rim}
            stroke-width={hex.paint.rimWidth}
        ></polygon>
    {/each}
    <path
        d={COAST_PATH}
        fill="none"
        stroke="var(--rtr-coast)"
        stroke-width="4.4"
        stroke-linejoin="round"
        stroke-linecap="round"
    ></path>
    {#each MOUNTAINS as hex (hex.hexId)}
        {@const occupied = railroadsIn(gameSession.gameState.track, hex.hexId).length > 0}
        <g
            transform="translate({hex.center.x} {hex.center.y +
                (occupied ? -GLYPH_RISE : 1)}) scale({occupied ? OCCUPIED_GLYPH_SCALE : 1})"
            aria-hidden="true"
        >
            <path
                d="M-18 9 L-6.8 -9.2 L1.2 2.8 L7.2 -4.4 L18 9 Z"
                fill="var(--rtr-mountain-ink)"
                fill-opacity="0.6"
            ></path>
            <path
                d="M-10.2 -3.8 L-6.8 -9.2 L-3.6 -4.4 M5.2 -2 L7.2 -4.4 L9.2 -1.8"
                fill="none"
                stroke="var(--rtr-station)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-opacity="0.9"
            ></path>
        </g>
    {/each}
</g>
