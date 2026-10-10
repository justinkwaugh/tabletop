<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

<div class="px-4 pb-2 text-sm">
    {#each gameSession.gameState.activePlayerIds as playerId (playerId)}
        <p><PlayerName {playerId} /> is acting.</p>
    {/each}
</div>
