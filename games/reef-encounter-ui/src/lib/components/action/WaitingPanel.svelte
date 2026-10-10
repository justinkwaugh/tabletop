<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { waitingActivity } from '$lib/utils/waitingStatus.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const activity = $derived(waitingActivity(gameSession.gameState.machineState))
</script>

{#if activity}
    {#each gameSession.gameState.activePlayerIds as playerId (playerId)}
        <p class="prompt"><PlayerName {playerId} /> {activity}</p>
    {/each}
{/if}
