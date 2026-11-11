<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerState from './PlayerState.svelte'

    const gameSession = getGameSession()
</script>

<div class="space-y-2">
    {#each gameSession.gameState.seatOrder as playerId (playerId)}
        <PlayerState {playerId} />
    {/each}
</div>
