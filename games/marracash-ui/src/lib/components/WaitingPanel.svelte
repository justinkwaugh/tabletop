<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

<p class="font-semibold">
    {#if gameSession.gameState.result}
        The game is over.
    {:else}
        Waiting for
        {#each gameSession.gameState.activePlayerIds as playerId, index (playerId)}
            {#if index > 0},
            {/if}<PlayerName {playerId} />
        {/each}
    {/if}
</p>
