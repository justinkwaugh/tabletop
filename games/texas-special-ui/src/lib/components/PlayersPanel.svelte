<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerState from './PlayerState.svelte'
    import RailroadsPanel from './RailroadsPanel.svelte'
    import { railroadPaneOnRight } from '$lib/utils/tableLayout.svelte.js'

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
    {#if !railroadPaneOnRight.current}
        <RailroadsPanel />
    {/if}
</div>
