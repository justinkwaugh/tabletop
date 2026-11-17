<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CAPACITY_MARK, capacityMarks } from '$lib/utils/cityMarks.js'
    import { MAP_LAYOUTS } from '$lib/utils/mapLayouts.js'
    import { HEX_LIMIT_MARK } from '$lib/utils/terrainMarks.js'

    const gameSession = getGameSession()

    // Displayed Game State: the shown state's map's cities with a limit of their own, and its other
    // hexes that hold one locomotive.
    const board = $derived(gameSession.boardFrame)
    const marks = $derived(
        capacityMarks(board, MAP_LAYOUTS[board.mapId].limitMarksInHex).map((mark) => ({
            ...mark,
            key: mark.cityId ?? mark.hexId
        }))
    )
    const seaMarks = $derived(marks.filter((mark) => !mark.inHex))
    const inHexMarks = $derived(marks.filter((mark) => mark.inHex))
    const SIDE = CAPACITY_MARK.side
    const INSIDE = HEX_LIMIT_MARK.side
</script>

<!-- R-4.1.3, R-4.1.4, R-8: beside each hex with a limit of its own, in the water, a white outline of
     a cube with the most locomotives it holds: 1 on the East Coast and beside Australia's
     long-distance hexes, 6 at Chicago. Where no side of the hex opens on water, the same mark inked
     on a pale ground inside the hex. -->
<g class="capacity-marks" aria-hidden="true" data-capacity-marks>
    {#each seaMarks as mark (mark.key)}
        <g transform="translate({mark.x} {mark.y})" data-limit-in-sea={mark.key}>
            <rect
                x={-SIDE / 2}
                y={-SIDE / 2}
                width={SIDE}
                height={SIDE}
                rx="3"
                fill="none"
                stroke="var(--rtr-white)"
                stroke-width="2"
            ></rect>
            <text
                class="rtr-serif"
                y="5.2"
                text-anchor="middle"
                font-size="15"
                fill="var(--rtr-white)">{mark.text}</text
            >
        </g>
    {/each}
    {#each inHexMarks as mark (mark.key)}
        <g transform="translate({mark.x} {mark.y})" data-limit-in-hex={mark.key}>
            <rect
                x={-INSIDE / 2}
                y={-INSIDE / 2}
                width={INSIDE}
                height={INSIDE}
                rx={HEX_LIMIT_MARK.radius}
                fill="var(--rtr-white)"
                fill-opacity={HEX_LIMIT_MARK.groundOpacity}
                stroke="var(--rtr-ink)"
                stroke-width={HEX_LIMIT_MARK.strokeWidth}
            ></rect>
            <text
                class="rtr-serif"
                y={HEX_LIMIT_MARK.baseline}
                text-anchor="middle"
                font-size={HEX_LIMIT_MARK.fontSize}
                fill="var(--rtr-ink)">{mark.text}</text
            >
        </g>
    {/each}
</g>
