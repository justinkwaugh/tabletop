<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import { START_CUE, startCues } from '$lib/utils/startCues.js'

    const gameSession = getGameSession()

    // Worked out from the displayed state, so the cues follow every placement, for every seat.
    const cues = $derived(
        BOARD_LOOK.startCue === 'dashed-band' ? startCues(gameSession.gameState) : []
    )
</script>

<!-- R-4.2.3, R-4.2.4: where a newly available railroad could start now, a dashed hex inside the
     city in its colour over a white stroke; static, under the cubes, the scrim and the lit rings. -->
<g class="start-cues" aria-hidden="true">
    {#each cues as cue (`${cue.railroadId}:${cue.hexId}`)}
        <g data-start-cue={cue.railroadId} data-hex={cue.hexId}>
            {#each cue.cells as points, cell (cell)}
                <polygon
                    {points}
                    fill="none"
                    stroke="var(--rtr-white)"
                    stroke-width={START_CUE.groundWidth}
                    stroke-linejoin="round"
                ></polygon>
                <polygon
                    {points}
                    fill="none"
                    stroke={railroadStyle(cue.railroadId).cue}
                    stroke-width={START_CUE.width}
                    stroke-dasharray={START_CUE.dash}
                    stroke-linejoin="round"
                ></polygon>
            {/each}
        </g>
    {/each}
</g>
