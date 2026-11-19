<script lang="ts">
    import { fade } from 'svelte/transition'
    import { Color } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries, type HistoryEntry } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    let replaying = $state.raw<{ entryId: string; entries: HistoryEntry[] } | undefined>(undefined)
    const liveEntries = $derived(historyEntries(session.actions))
    const entries = $derived((replaying?.entries ?? liveEntries).toReversed())

    async function replay(entry: HistoryEntry) {
        if (replaying) return
        replaying = { entryId: entry.id, entries: liveEntries }
        try {
            await session.history.replayRange(entry.firstIndex, entry.lastIndex)
        } finally {
            replaying = undefined
        }
    }
</script>

<div class="history h-full min-h-[300px] w-full overflow-auto rounded-lg p-2">
    {#if session.gameState.result && !session.isViewingHistory}
        <div class="divider">Game over</div>
    {/if}
    {#each entries as entry (entry.id)}
        <button
            type="button"
            class="entry"
            class:replaying={replaying?.entryId === entry.id}
            title="Replay on the board"
            onclick={() => replay(entry)}
            in:fade={{ duration: 200 }}
        >
            <svg
                class="mt-[3px] shrink-0 cell-icon"
                class:blue={entry.kind === 'place' && entry.color === Color.Blue}
                class:none={entry.kind === 'call'}
                viewBox="-8 -9 16 18"
                width="14"
                height="16"
                aria-hidden="true"
                ><path d="M0 -8 L6.93 -4 L6.93 4 L0 8 L-6.93 4 L-6.93 -4 Z"></path></svg
            >
            <span class="text-left text-[15px] leading-snug">
                <HistoryEntryLine {entry} />
            </span>
        </button>
    {:else}
        <div class="p-3 text-center italic text-(--hex-ink-quiet)">No moves yet</div>
    {/each}
</div>

<style>
    /* Light like the player panels. */
    .history {
        background: var(--hex-panel);
        color: var(--hex-ink);
        box-shadow:
            inset 0 0 0 1px var(--hex-panel-edge),
            var(--hex-panel-shadow);
    }

    /* The cell the entry filled; a swap takes Red. */
    .cell-icon {
        fill: var(--hex-red);
    }

    .cell-icon.blue {
        fill: var(--hex-blue);
    }

    .cell-icon.none {
        visibility: hidden;
    }

    .entry {
        display: flex;
        width: 100%;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 6px;
    }

    @media (hover: hover) {
        .entry:hover {
            background: var(--hex-panel-hover);
        }
    }

    .entry.replaying {
        background: rgb(242 193 78 / 0.18);
    }

    .divider {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 6px 4px 10px;
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--hex-ink-quiet);
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--hex-panel-rule);
    }
</style>
