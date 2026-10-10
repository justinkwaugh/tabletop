<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import ActionDescription from '$lib/components/ActionDescription.svelte'
    import { describeAction } from '$lib/utils/actionDescription.js'
    import { waitingActivity } from '$lib/utils/waitingStatus.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const activity = $derived(waitingActivity(gameSession.gameState.machineState))
    const lastPlayerAction = $derived(
        gameSession.actions.findLast(
            (action) =>
                action.playerId !== undefined && describeAction(action, 'their') !== undefined
        )
    )
</script>

{#if activity}
    {#each gameSession.gameState.activePlayerIds as playerId (playerId)}
        <p class="prompt"><PlayerName {playerId} /> {activity}</p>
    {/each}
{/if}
{#if lastPlayerAction}
    <p class="detail"><ActionDescription action={lastPlayerAction} /></p>
{/if}
