<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerState from './PlayerState.svelte'

    const gameSession = getGameSession()
    const orderedPlayers = $derived(
        gameSession.gameState
            .initiativeOrder()
            .map((playerId) => gameSession.gameState.getPlayerState(playerId))
    )
</script>

<div class="space-y-2">
    {#each orderedPlayers as playerState, index (playerState.playerId)}
        <PlayerState {playerState} initiative={index + 1} />
    {/each}
</div>
