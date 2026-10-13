<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PHASE_LABELS } from '$lib/utils/presentation.js'
    import LastActionDescription from '../LastActionDescription.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const waitingOn = $derived(
        gameState.activePlayerIds.filter((playerId) => playerId !== gameSession.myPlayerId)
    )
</script>

<div class="waiting">
    {#if gameSession.currentPhase && waitingOn.length > 0}
        {@const phase = PHASE_LABELS[gameSession.currentPhase].toLowerCase()}
        <span class="inline-flex flex-wrap items-center gap-x-1">
            Waiting for
            {#each waitingOn as playerId, index (playerId)}
                <PlayerName {playerId} />{index < waitingOn.length - 1 ? ',' : ''}
            {/each}
            to finish {phase}.
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
