<script lang="ts">
    import { RAILROAD_IDS } from '@tabletop/promontory-point'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SEA_SLOTS } from '$lib/utils/boardGeometry.js'
    import { endTrackerStatus } from '$lib/utils/boardLayout.js'
    import BagArt from './BagArt.svelte'
    import EndTracker from './EndTracker.svelte'
    import ShareDeck from './ShareDeck.svelte'

    const gameSession = getGameSession()
    const status = $derived(endTrackerStatus(gameSession.gameState))
</script>

<!-- O-8: the share decks, the bag and the end tracker in the open sea. -->
{#each RAILROAD_IDS as railroadId (railroadId)}
    <ShareDeck
        {railroadId}
        count={gameSession.flights.deckCount(railroadId) ??
            gameSession.gameState.shareDeckCount(railroadId)}
        box={SEA_SLOTS.decks[railroadId]}
    />
{/each}
<BagArt remaining={gameSession.gameState.bag.remaining} box={SEA_SLOTS.bag} />
<EndTracker {status} box={SEA_SLOTS.endTracker} />
