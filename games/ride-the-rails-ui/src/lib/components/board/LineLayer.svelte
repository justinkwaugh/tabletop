<script lang="ts">
    import type { Link } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { polylinePoints, routeSegments, transcontinentalRoute } from '$lib/utils/routePath.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    let { lastJourney }: { lastJourney: readonly Link[] } = $props()

    const gameSession = getGameSession()

    // R-4.3.3: the claimed line stays drawn from the claim to the game's end.
    const claimedLine = $derived(
        gameSession.gameState.transcontinental
            ? transcontinentalRoute(gameSession.gameState.track)
            : undefined
    )
    const segments = $derived(routeSegments(lastJourney))
</script>

<g class="lines" aria-hidden="true" fill="none" stroke-linejoin="round" stroke-linecap="round">
    {#if claimedLine}
        <polyline points={polylinePoints(claimedLine)} stroke="var(--rtr-gold)" stroke-width="3"
        ></polyline>
    {/if}
    <!-- U-7: the last journey, thinner than a staged route, over the same dark halo. -->
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
