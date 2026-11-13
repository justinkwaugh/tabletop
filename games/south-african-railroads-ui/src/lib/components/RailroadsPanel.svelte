<script lang="ts">
    import type { RailroadId } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import RailroadCard from './RailroadCard.svelte'

    const gameSession = getGameSession()

    const offerable = $derived(
        gameSession.offeringStock ? gameSession.gameState.unsoldOffers() : []
    )

    function choiceFor(railroadId: RailroadId): 'build' | 'offer' | undefined {
        if (gameSession.railroadChoices.includes(railroadId)) {
            return 'build'
        }
        return offerable.includes(railroadId) ? 'offer' : undefined
    }

    function isSelected(railroadId: RailroadId): boolean {
        return (
            (gameSession.railroadChoices.length > 0 &&
                gameSession.selectedRailroad === railroadId) ||
            gameSession.gameState.auction?.railroadId === railroadId
        )
    }
</script>

<section class="railroads" aria-label="Railroads">
    {#each gameSession.gameState.map.railroads as railroad (railroad.id)}
        <RailroadCard
            railroadId={railroad.id}
            choice={choiceFor(railroad.id)}
            selected={isSelected(railroad.id)}
        />
    {/each}
</section>

<style>
    .railroads {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
</style>
