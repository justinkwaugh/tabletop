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
            <span
                class="mt-[5px] size-[12px] shrink-0 rounded-full shadow-[inset_0_0_0_1px_#5b5446] stone-dot"
                class:white={entry.kind === 'place' && entry.color === Color.White}
                class:none={entry.kind === 'call'}
            ></span>
            <span class="text-left text-[15px] leading-snug">
                <HistoryEntryLine {entry} />
            </span>
        </button>
    {:else}
        <div class="p-3 text-center italic text-(--y-ink-quiet)">No moves yet</div>
    {/each}
</div>

<style>
    /* Light like the player panels, so black stones show as well as white. */
    .history {
        background: var(--y-panel);
        color: var(--y-ink);
        box-shadow:
            inset 0 0 0 1px var(--y-panel-edge),
            var(--y-panel-shadow);
    }

    /* The stone the entry placed; a swap takes Black. */
    .stone-dot {
        background: #18181a;
    }

    .stone-dot.white {
        background: #ece9e2;
    }

    .stone-dot.none {
        visibility: hidden;
    }

    .entry {
        display: flex;
        width: 100%;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 6px;
    }

    .entry:hover {
        background: var(--y-panel-hover);
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
        color: var(--y-ink-quiet);
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--y-panel-rule);
    }
</style>
