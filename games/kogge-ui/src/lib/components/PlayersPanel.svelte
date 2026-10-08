<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerState from './PlayerState.svelte'

    const gameSession = getGameSession()
    const order = $derived(gameSession.gameState.turnManager.turnOrder)
</script>

<div class="flex flex-col gap-2 pb-2">
    {#each order as playerId (playerId)}
        <PlayerState {playerId} />
    {/each}
</div>
