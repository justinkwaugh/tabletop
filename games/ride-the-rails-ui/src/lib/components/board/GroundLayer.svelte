<script lang="ts">
    import { USA_HEXES, railroadsIn } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOARD_EXTENTS, COAST_PATH, hexCenter, hexPoints } from '$lib/utils/boardGeometry.js'

    const gameSession = getGameSession()

    const HEXES = USA_HEXES.map((hex) => ({
        hexId: hex.id,
        mountain: hex.terrain === 'mountain',
        points: hexPoints(hex.id),
        center: hexCenter(hex.id)
    }))
    const MOUNTAINS = HEXES.filter((hex) => hex.mountain)

    // A mountain glyph moves up out of the way once a locomotive stands in the hex.
    const GLYPH_RISE = 18
</script>

<g class="ground">
    <rect
        x={BOARD_EXTENTS.x}
        y={BOARD_EXTENTS.y}
        width={BOARD_EXTENTS.width}
        height={BOARD_EXTENTS.height}
        fill="var(--rtr-sea)"
    ></rect>
    {#each HEXES as hex (hex.hexId)}
        <polygon
            points={hex.points}
            fill={hex.mountain ? 'var(--rtr-mountain)' : 'var(--rtr-plain)'}
            stroke="var(--rtr-hex-edge)"
            stroke-width="1.6"
        ></polygon>
    {/each}
    <path
        d={COAST_PATH}
        fill="none"
        stroke="var(--rtr-hex-edge)"
        stroke-width="4.8"
        stroke-linejoin="round"
    ></path>
    {#each MOUNTAINS as hex (hex.hexId)}
        {@const occupied = railroadsIn(gameSession.gameState.track, hex.hexId).length > 0}
        <g
            transform="translate({hex.center.x} {hex.center.y + (occupied ? -GLYPH_RISE : 2)})"
            aria-hidden="true"
        >
            <path
                d="M-16 8 L-6 -8 L2 3 L7 -3.6 L16 8 Z"
                fill="var(--rtr-mountain-ink)"
                fill-opacity={occupied ? 0.35 : 0.55}
            ></path>
            <path
                d="M-9.2 -3.6 L-6 -8 L-3.2 -4.4"
                fill="none"
                stroke="var(--rtr-plain)"
                stroke-width="1.8"
                stroke-opacity="0.8"
            ></path>
        </g>
    {/each}
</g>
