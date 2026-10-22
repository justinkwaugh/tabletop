<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    const lastEntry = $derived(
        historyEntries(session.actions, (id) => session.gameState.opponentOf(id)).at(-1)
    )

    const prompt = $derived.by(() => {
        if (session.chosenFrom) return 'Choose where it lands'
        if (session.canMove && session.canClaim) return 'Claim a color or move a stack'
        if (session.canMove) return 'Choose a stack to move'
        if (session.canClaim) return 'Claim a color to be able to move'
        return undefined
    })
</script>

<!-- One row, as Bus and Magna Grecia do: the last move while you wait, the prompt on your turn. -->
<div class="panel">
    {#if session.isViewingHistory || !prompt}
        {#if lastEntry}
            <HistoryEntryLine entry={lastEntry} brief />
        {:else}
            <span>{session.isViewingHistory ? 'The game begins' : 'Waiting for turn'}</span>
        {/if}
    {:else}
        <span>{prompt}</span>
    {/if}
</div>

<style>
    .panel {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px 8px;
        min-height: 50px;
        padding: 4px 16px;
        text-align: center;
        font-size: 18px;
        letter-spacing: 0.02em;
        color: var(--lyngk-ink);
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 16px;
        }
    }
</style>
