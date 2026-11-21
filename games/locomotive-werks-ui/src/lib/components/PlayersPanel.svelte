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

<div class="space-y-2">
    {#each orderedPlayers as playerState (playerState.playerId)}
        <PlayerState {playerState} />
    {/each}
    <label class="color-blind">
        <input
            type="checkbox"
            checked={gameSession.colorBlind}
            onchange={(event) => gameSession.setColorBlind(event.currentTarget.checked)}
        />
        Colour-blind colours and shapes
    </label>
</div>

<style>
    .color-blind {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 4px;
        color: #232d36;
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 13px;
        cursor: pointer;
    }

    .color-blind input {
        width: 15px;
        height: 15px;
        accent-color: #25303a;
    }
</style>
