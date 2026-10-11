<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerState from './PlayerState.svelte'
    import PlayerAreaPrototype from './prototype/playerArea/PlayerAreaPrototype.svelte'
    import { playerArea } from './prototype/playerArea/campaignMock.svelte.js'

    const gameSession = getGameSession()
    const orderedPlayers = $derived(
        gameSession.gameState
            .initiativeOrder()
            .map((playerId) => gameSession.gameState.getPlayerState(playerId))
    )
</script>

{#if playerArea.variant}
    <PlayerAreaPrototype />
{:else}
    <div class="space-y-2">
        {#each orderedPlayers as playerState, index (playerState.playerId)}
            <PlayerState {playerState} initiative={index + 1} />
        {/each}
    </div>
{/if}
