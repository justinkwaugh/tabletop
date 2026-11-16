<script lang="ts">
    import { transcontinentalLine, type Link } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { polylinePoints, routeCubeSegments } from '$lib/utils/routePath.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    let { lastJourney }: { lastJourney: readonly Link[] } = $props()

    const gameSession = getGameSession()

    // R-4.3.3: once its claim has played, the claimed line is drawn only while the viewer shows
    // it with the Transcontinental chip.
    const claimedLine = $derived(
        gameSession.showsTranscontinentalLine
            ? transcontinentalLine(gameSession.gameState.track)?.hexIds
            : undefined
    )
    const segments = $derived(routeCubeSegments(lastJourney, gameSession.gameState.track))
</script>

<g class="lines" aria-hidden="true" fill="none" stroke-linejoin="round" stroke-linecap="round">
    {#if claimedLine}
        <polyline points={polylinePoints(claimedLine)} stroke="var(--rtr-gold)" stroke-width="3"
        ></polyline>
    {/if}
    <!-- U-7: the last journey through the cubes it rode, thinner than a staged route, over the same
         dark halo. -->
    {#each segments as segment (segment.key)}
        <polyline points={segment.points} stroke="var(--rtr-halo)" stroke-width="7.4"></polyline>
    {/each}
    {#each segments as segment (segment.key)}
        <polyline
            points={segment.points}
            stroke={railroadStyle(segment.railroadId).fill}
            stroke-width="3.4"
        ></polyline>
    {/each}
</g>
