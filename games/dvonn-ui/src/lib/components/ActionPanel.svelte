<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import { holdTallest } from './holdTallest.js'

    const session = getGameSession()

    const lastEntry = $derived(historyEntries(session.actions).at(-1))

    // Rule E8: a player without a move passes, and the other moves again.
    const passedPlayerId = $derived(
        lastEntry?.kind === 'call' ? undefined : lastEntry?.passedPlayerId
    )
    const opponentPassed = $derived(
        passedPlayerId !== undefined && passedPlayerId !== session.myPlayer?.id
    )

    const prompt = $derived.by(() => {
        if (session.canPlace) {
            return session.placingDvonn
                ? 'Place a DVONN piece on any space'
                : 'Place a piece on any empty space'
        }
        if (session.chosenFrom) return 'Choose where the stack lands'
        if (session.canMove && opponentPassed && passedPlayerId) {
            return `${session.getPlayerName(passedPlayerId)} cannot move; move again`
        }
        if (session.canMove) return 'Choose a piece or stack to move'
        return undefined
    })
</script>

<!-- One row, as Bus and Magna Grecia do: the last move while you wait, the prompt on your turn. -->
<div class="panel" {@attach holdTallest}>
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
        color: var(--dvonn-ink);
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 16px;
        }
    }
</style>
