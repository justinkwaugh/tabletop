<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import PlayerCard from './PlayerCard.svelte'

    const session = getGameSession()
    const players = $derived(
        session.gameState.turnManager.turnOrder.map((playerId) =>
            session.gameState.getPlayerState(playerId)
        )
    )
</script>

<div class="players">
    {#each players as player (player.playerId)}
        <PlayerCard {player} score={session.scores[player.playerId]} />
    {/each}
</div>

<style>
    .players {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 6px 2px 12px;
        text-align: left;
    }
</style>
