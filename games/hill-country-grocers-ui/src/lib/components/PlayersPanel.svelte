<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CompaniesPanel from './CompaniesPanel.svelte'
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
    <CompaniesPanel />
</div>
