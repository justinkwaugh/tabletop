<script lang="ts">
    import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PLATE_MARK } from '$lib/utils/approachPlates.js'
    import { MARK_PAPER } from '$lib/utils/approachSymbols.js'
    import PrintedMark from './PrintedMark.svelte'

    const gameSession = getGameSession()
</script>

<g class="pointer-events-none">
    {#each gameSession.approachPlates as { approach, box, marks } (approach)}
        {@const bar = APPROACH_GEOMETRY[approach]}
        <g transform="translate({bar.centre.x} {bar.centre.y}) rotate({bar.angle})">
            <rect {...box} fill={MARK_PAPER}></rect>
            {#each marks as { mark, topLeft }, row (row)}
                <g transform="translate({topLeft.x} {topLeft.y})">
                    <PrintedMark {mark} {...PLATE_MARK} />
                </g>
            {/each}
        </g>
    {/each}
</g>
