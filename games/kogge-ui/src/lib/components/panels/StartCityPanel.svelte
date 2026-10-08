<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { cityInfo } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const choices = $derived(gameSession.gameState.startChoices ?? [])
    const myChoice = $derived(choices.find((choice) => choice.playerId === gameSession.myPlayerId))
</script>

<div class="flex flex-col gap-1">
    {#if gameSession.startCityOptions.length > 0}
        <div class="kogge-prompt">Choose the city for your first trading office</div>
        <div class="kogge-note">
            Click a city on the map. Everyone chooses in secret; if three of you pick the same city,
            those three choose again.
            {#if myChoice && myChoice.excluded.length > 0}
                You may not choose {myChoice.excluded
                    .map((city) => cityInfo(city).name)
                    .join(' or ')} again.
            {/if}
        </div>
    {:else if myChoice?.city !== undefined}
        <div class="kogge-prompt">
            Your office will stand in {cityInfo(myChoice.city).name}
        </div>
    {:else}
        <div class="kogge-prompt">The merchants choose their start cities in secret</div>
    {/if}
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {#each choices as choice (choice.playerId)}
            <span class="inline-flex items-center gap-1">
                <PlayerName playerId={choice.playerId} />
                <span class="opacity-75">{choice.submitted ? 'has chosen' : 'is choosing…'}</span>
            </span>
        {/each}
    </div>
</div>
