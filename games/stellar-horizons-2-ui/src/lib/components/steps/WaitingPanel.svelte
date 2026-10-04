<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import LastActionDescription from '../LastActionDescription.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const waitingOn = $derived(
        gameState.activePlayerIds.filter((playerId) => playerId !== gameSession.myPlayerId)
    )
</script>

<div class="waiting">
    {#if gameState.machineState === MachineState.PlayingTurn && waitingOn.length > 0}
        <span class="inline-flex flex-wrap items-center gap-x-1">
            Waiting for
            {#each waitingOn as playerId, index (playerId)}
                <PlayerName {playerId} />{index < waitingOn.length - 1 ? ',' : ''}
            {/each}
            to finish {gameState.year}.
        </span>
    {:else}
        <LastActionDescription />
    {/if}
</div>

<style>
    .waiting {
        display: flex;
        justify-content: center;
        padding: 6px 0;
        color: #9fb4d0;
    }
</style>
