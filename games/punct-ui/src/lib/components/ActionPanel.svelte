<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    const lastEntry = $derived(historyEntries(session.actions).at(-1))
    const moving = $derived(session.staged?.from !== undefined)

    // The buttons finish the sentence, so a prompt and its buttons fit one row on a phone.
    const TURNABLE = 'turnable'
    const prompt = $derived.by(() => {
        if (session.staged) {
            return session.options.length > 1 ? TURNABLE : 'It fits one way:'
        }
        if (session.chosenPiece) return 'Choose where its PÜNCT goes'
        if (session.canPlace) {
            return session.movablePieces.length > 0
                ? 'Tap a space to place, or a piece to move'
                : 'Tap a space to place a piece'
        }
        if (session.canMovePiece) return 'Choose a piece to move'
        return undefined
    })
</script>

<!-- One row, as Bus and Magna Grecia do: the last move while you wait, the prompt and its buttons on your turn. -->
<div class="panel">
    {#if session.isViewingHistory || !prompt}
        {#if lastEntry}
            <HistoryEntryLine entry={lastEntry} brief />
        {:else}
            <span>{session.isViewingHistory ? 'The game begins' : 'Waiting for turn'}</span>
        {/if}
    {:else}
        {#if prompt === TURNABLE}
            <!-- Turn is a button in the sentence; tapping the piece does the same. -->
            <span class="sentence"
                >Tap the piece to <button
                    type="button"
                    class="choice inline"
                    onclick={() => session.turnStaged()}>turn</button
                > it, then</span
            >
        {:else}
            <span>{prompt}</span>
        {/if}
        {#if session.staged}
            <button type="button" class="choice primary" onclick={() => session.confirm()}
                >{moving ? 'Drop' : 'Place'}</button
            >
        {/if}
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
        color: var(--punct-ink);
    }

    .choice {
        display: inline-flex;
        align-items: center;
        padding: 3px 14px;
        border-radius: 999px;
        border: 2px solid var(--punct-panel-edge);
        color: var(--punct-ink);
        font-size: 15px;
    }

    .choice.inline {
        padding: 0 10px;
        margin: 0 2px;
        font-size: inherit;
    }

    @media (max-width: 639px) {
        .panel {
            gap: 4px 6px;
            font-size: 16px;
            padding: 4px 8px;
        }

        .choice {
            padding: 3px 11px;
        }

        .choice.inline {
            padding: 0 8px;
        }
    }

    .choice:hover {
        background: rgb(0 0 0 / 0.05);
    }

    .choice.primary {
        border-color: #1b8fa0;
        background: rgb(94 240 255 / 0.25);
        font-weight: 600;
    }
</style>
