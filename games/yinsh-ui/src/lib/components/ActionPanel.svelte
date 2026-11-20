<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import { holdTallest } from './holdTallest.js'
    import GameEndPanel from './GameEndPanel.svelte'

    const session = getGameSession()

    // The ending takes the panel's place, so the height it holds keeps the board still.
    const ended = $derived(session.gameState.result !== undefined && !session.isViewingHistory)

    const lastEntry = $derived(historyEntries(session.actions).at(-1))

    const toPlace = $derived(
        session.myPlayer ? session.gameState.ringsToPlace(session.myPlayer.id) : 0
    )

    // The opponent could not move, so you move again.
    const passedPlayerId = $derived(
        lastEntry?.kind === 'place' || lastEntry?.kind === 'call'
            ? undefined
            : lastEntry?.passedPlayerId
    )

    const prompt = $derived.by(() => {
        if (session.canPlace) return `Place a ring on any point (${toPlace} to place)`
        if (session.chosenFrom) return 'Choose where the ring moves'
        if (session.canMove && passedPlayerId !== undefined) {
            return `${session.getPlayerName(passedPlayerId)} cannot move; move again`
        }
        if (session.canMove) return 'Choose a ring to move'
        if (session.anchor) return 'Choose the other end of the row'
        if (session.canRemoveRow) return 'Choose a row of five to remove'
        if (session.canRemoveRing) return 'Choose one of your rings to remove'
        return undefined
    })
</script>

<!-- One row, as Bus and Magna Grecia do: the last move while you wait, the prompt on your turn. -->
<div class="panel" {@attach holdTallest}>
    {#if ended}
        <GameEndPanel />
    {:else if session.isViewingHistory || !prompt}
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
