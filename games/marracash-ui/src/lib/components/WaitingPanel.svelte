<script lang="ts">
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

<p class="font-semibold">
    Waiting for
        {#each gameSession.gameState.activePlayerIds as playerId, index (playerId)}
            {#if index > 0},
            {/if}<PlayerTag {playerId} />
        {/each}
</p>
