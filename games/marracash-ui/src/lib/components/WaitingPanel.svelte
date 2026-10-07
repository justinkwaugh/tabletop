<script lang="ts">
    import type { Snippet } from 'svelte'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { lead }: { lead?: Snippet } = $props()
    const gameSession = getGameSession()
</script>

<p class="marracash-prompt">
    {@render lead?.()}
    {#if gameSession.gameState.activePlayerIds.length === 0 && gameSession.gameState.auction}
        All bids are in.
    {:else}
        Waiting for
        {#each gameSession.gameState.activePlayerIds as playerId (playerId)}
            {' '}<PlayerTag {playerId} />
        {/each}
    {/if}
</p>
