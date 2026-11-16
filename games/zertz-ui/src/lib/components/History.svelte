<script lang="ts">
    import { fade } from 'svelte/transition'
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

<div
    class="h-full min-h-[300px] w-full overflow-auto rounded-lg bg-(--zertz-panel) p-2 text-(--zertz-ink) shadow-[inset_0_0_0_1px_var(--zertz-panel-edge)]"
>
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
                class="mt-[5px] h-3 w-3 shrink-0 rounded-full"
                style:background={session.colors.getPlayerUiColor(entry.playerId)}
            ></span>
            <span class="text-left text-[15px] leading-snug">
                <HistoryEntryLine {entry} />
            </span>
        </button>
    {:else}
        <div class="p-3 text-center italic text-(--zertz-ink-quiet)">No moves yet</div>
    {/each}
</div>

<style>
    .entry {
        display: flex;
        width: 100%;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 6px;
    }

    .entry:hover {
        background: rgb(255 255 255 / 0.06);
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
        color: var(--zertz-ink-quiet);
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--zertz-panel-edge);
    }
</style>
