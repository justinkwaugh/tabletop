<script lang="ts">
    import { RAILROAD_IDS, sharePrice } from '@tabletop/promontory-point'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { STRIP_SLOTS } from '$lib/utils/boardGeometry.js'
    import { endTrackerStatus } from '$lib/utils/boardLayout.js'
    import BagArt from './BagArt.svelte'
    import EndTracker from './EndTracker.svelte'
    import ShareDeck from './ShareDeck.svelte'
    import StripCard from './StripCard.svelte'

    const gameSession = getGameSession()
    const status = $derived(endTrackerStatus(gameSession.gameState))
</script>

<!-- O-8: the strip left of the map: the bag, the share decks for sale and the end tracker. -->
<BagArt remaining={gameSession.gameState.bag.remaining} box={STRIP_SLOTS.bag} />
<g data-strip-shares>
    <StripCard box={STRIP_SLOTS.shares} title="SHARES FOR SALE" />
    {#each RAILROAD_IDS as railroadId (railroadId)}
        <ShareDeck
            {railroadId}
            count={gameSession.flights.deckCount(railroadId) ??
                gameSession.gameState.shareDeckCount(railroadId)}
            price={sharePrice(gameSession.gameState, railroadId)}
            box={STRIP_SLOTS.decks[railroadId]}
        />
    {/each}
</g>
<EndTracker {status} box={STRIP_SLOTS.endTracker} />
