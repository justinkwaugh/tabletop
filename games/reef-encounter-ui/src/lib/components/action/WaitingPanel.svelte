<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import Phrases from '$lib/components/Phrases.svelte'
    import { describeActions } from '$lib/utils/actionDescription.js'
    import { boardName } from '$lib/utils/reefSquare.js'
    import { previousTurn } from '$lib/utils/historyEntries.js'
    import { waitingActivity } from '$lib/utils/statusText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const lastTurn = $derived(previousTurn(gameSession.actions, state.activePlayerIds))
    const phrases = $derived(
        lastTurn
            ? describeActions(
                  lastTurn.actions,
                  lastTurn.playerId === gameSession.myPlayer?.id ? 'your' : 'their',
                  gameSession.possessiveName,
                  (boardId) => boardName(gameSession.gameState.reefs, boardId)
              )
            : []
    )
</script>

{#each state.activePlayerIds as playerId (playerId)}
    {@const activity = waitingActivity(state.machineState, playerId === gameSession.myPlayer?.id)}
    {#if activity}
        <p class="prompt"><PlayerName {playerId} /> {activity}</p>
    {/if}
{/each}
<Phrases {phrases} />
