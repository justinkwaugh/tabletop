<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()
    const placed = $derived(session.gameState.trust?.startingCities.length ?? 0)
</script>

<p class="prompt">
    {#if placed === 0}
        Place the Trust's first house: choose any city on the map. It blocks that city until Step 2.
    {:else}
        Place Trust house {placed + 1} of 6 in a city next to one the Trust already holds.
    {/if}
</p>
