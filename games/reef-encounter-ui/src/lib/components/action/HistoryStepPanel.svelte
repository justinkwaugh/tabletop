<script lang="ts">
    import Phrases from '$lib/components/Phrases.svelte'
    import { describeActions } from '$lib/utils/actionDescription.js'
    import { boardName } from '$lib/utils/reefSquare.js'
    import { historyStep } from '$lib/utils/historyEntries.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const step = $derived(historyStep(gameSession.actions))
    const phrases = $derived(
        describeActions(
            step,
            step[0]?.playerId === gameSession.myPlayer?.id ? 'your' : 'their',
            gameSession.possessiveName,
            (boardId) => boardName(gameSession.gameState.reefs, boardId)
        )
    )
</script>

{#if phrases.length > 0}
    <Phrases {phrases} />
{:else}
    <p class="detail">The game is about to begin.</p>
{/if}
