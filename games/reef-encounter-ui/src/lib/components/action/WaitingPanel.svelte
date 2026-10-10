<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import Phrases from '$lib/components/Phrases.svelte'
    import { describeActions } from '$lib/utils/actionDescription.js'
    import { previousTurn } from '$lib/utils/historyEntries.js'
    import { waitingActivity } from '$lib/utils/waitingStatus.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const activity = $derived(waitingActivity(state.machineState))
    const lastTurn = $derived(previousTurn(gameSession.actions, state.activePlayerIds))
    const phrases = $derived(
        lastTurn
            ? describeActions(
                  lastTurn.actions,
                  lastTurn.playerId === gameSession.myPlayer?.id ? 'your' : 'their'
              )
            : []
    )
</script>

{#if activity}
    {#each state.activePlayerIds as playerId (playerId)}
        <p class="prompt"><PlayerName {playerId} /> {activity}</p>
    {/each}
{/if}
<Phrases {phrases} />
