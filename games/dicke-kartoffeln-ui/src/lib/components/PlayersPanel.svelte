<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerState from './PlayerState.svelte'

    const gameSession = getGameSession()

    const orderedPlayers = $derived(
        gameSession.gameState.turnManager.turnOrder.map((playerId) =>
            gameSession.gameState.getPlayerState(playerId)
        )
    )
</script>

<div class="players">
    {#each orderedPlayers as playerState (playerState.playerId)}
        <PlayerState {playerState} />
    {/each}
</div>

<style>
    .players {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
</style>
