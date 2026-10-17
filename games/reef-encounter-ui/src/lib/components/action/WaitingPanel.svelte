<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import PhraseLine from '$lib/components/PhraseLine.svelte'
    import { boardName } from '$lib/utils/reefSquare.js'
    import { previousTurn } from '$lib/utils/historyEntries.js'
    import { turnSummary } from '$lib/utils/turnRecap.js'
    import { waitingActivity } from '$lib/utils/statusText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const lastTurn = $derived(previousTurn(gameSession.actions, game.activePlayerIds))
    const summary = $derived(
        lastTurn
            ? turnSummary(
                  lastTurn.actions,
                  lastTurn.playerId === gameSession.myPlayer?.id ? 'your' : 'their',
                  (boardId) => boardName(gameSession.gameState.reefs, boardId)
              )
            : undefined
    )
</script>

{#each game.activePlayerIds as playerId (playerId)}
    {@const activity = waitingActivity(game.machineState, playerId === gameSession.myPlayer?.id)}
    {#if activity}
        <p class="prompt"><PlayerName {playerId} /> {activity}</p>
    {/if}
{/each}
{#if summary}
    <p class="detail summary">
        {#if lastTurn?.playerId}
            <PlayerName playerId={lastTurn.playerId} />
            <PhraseLine phrase={{ ...summary, playerId: lastTurn.playerId }} />
        {/if}
    </p>
{/if}

<style>
    /* One line; the History tab holds the rest. */
    .summary {
        display: -webkit-box;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 1;
        line-clamp: 1;
        line-height: 1.55;
    }
</style>
