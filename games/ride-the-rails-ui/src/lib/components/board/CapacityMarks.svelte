<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CAPACITY_MARK, capacityMarks } from '$lib/utils/cityMarks.js'

    const gameSession = getGameSession()

    // Displayed Game State: the shown state's map's cities with a limit of their own.
    const marks = $derived(capacityMarks(gameSession.boardFrame))
    const SIDE = CAPACITY_MARK.side
</script>

<!-- R-4.1.3, R-4.1.4: beside each city with its own limit, in the water, a white outline of a cube
     with the most locomotives it holds: 1 on the East Coast, 6 at Chicago. -->
<g class="capacity-marks" aria-hidden="true" data-capacity-marks>
    {#each marks as mark (mark.cityId)}
        <g transform="translate({mark.x} {mark.y})">
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
</g>
