<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { START_RING_RADIUS, START_RING_STROKES, startRingArcs } from '$lib/utils/cityMarks.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    let { railroadIds }: { railroadIds: readonly RailroadId[] } = $props()

    const arcs = $derived(startRingArcs(railroadIds.length))
</script>

<!-- Art plan, Start ring (BOARD_LOOK.startMark 'ring'): one segment per railroad that may start
     here, on a white ring with a dark outline round the station. -->
<g aria-hidden="true" data-start-ring={railroadIds.length}>
    <circle
        r={START_RING_RADIUS}
        fill="none"
        stroke="var(--rtr-station-ink)"
        stroke-width={START_RING_STROKES.outline}
    ></circle>
    <circle
        r={START_RING_RADIUS}
        fill="none"
        stroke="var(--rtr-station)"
        stroke-width={START_RING_STROKES.ground}
    ></circle>
    {#if arcs.length === 0 && railroadIds[0]}
        <circle
            r={START_RING_RADIUS}
            fill="none"
            stroke={railroadStyle(railroadIds[0]).fill}
            stroke-width={START_RING_STROKES.colour}
        ></circle>
    {/if}
    {#each arcs as arc, index (index)}
        {@const railroadId = railroadIds[index]}
        {#if railroadId}
            <path
                d={arc}
                fill="none"
                stroke={railroadStyle(railroadId).fill}
                stroke-width={START_RING_STROKES.colour}
            ></path>
        {/if}
    {/each}
</g>
