<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    const lastEntry = $derived(
        historyEntries(session.actions, (id) => session.gameState.opponentOf(id)).at(-1)
    )

    const toPlace = $derived(
        session.myPlayer ? session.gameState.ringsToPlace(session.myPlayer.id) : 0
    )

    // A player who moves twice running moves again because the opponent could not move.
    const opponentPassed = $derived(
        lastEntry?.kind === 'move' && lastEntry.playerId === session.myPlayer?.id
    )

    const prompt = $derived.by(() => {
        if (session.canPlace) return `Place a ring on any point (${toPlace} to place)`
        if (session.chosenFrom) return 'Choose where the ring moves'
        if (session.canMove && opponentPassed && lastEntry?.kind === 'move') {
            return `${session.getPlayerName(lastEntry.opponentId)} cannot move; move again`
        }
        if (session.canMove) return 'Choose a ring to move'
        if (session.anchor) return 'Choose the other end of the row'
        if (session.canRemoveRow) return 'Choose a row of five to remove'
        if (session.canRemoveRing) return 'Choose one of your rings to remove'
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
        color: var(--yinsh-ink);
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 16px;
        }
    }
</style>
