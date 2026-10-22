<script lang="ts">
    import { fade } from 'svelte/transition'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries, type HistoryEntry } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    let replaying = $state.raw<{ entryId: string; entries: HistoryEntry[] } | undefined>(undefined)
    const liveEntries = $derived(
        historyEntries(session.actions, (id) => session.gameState.opponentOf(id))
    )
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
                class="mt-[5px] size-[12px] shrink-0 rounded-full"
                style:background={session.colors.getPlayerBgColorValue(entry.playerId)}
            ></span>
            <span class="text-left text-[15px] leading-snug">
                <HistoryEntryLine {entry} />
            </span>
        </button>
    {:else}
        <div class="p-3 text-center italic text-(--lyngk-ink-quiet)">No moves yet</div>
    {/each}
</div>

<style>
    /* Light like the player panels, so black pieces show as well as the rest. */
    .history {
        background: #c9d6e8;
        color: #0d1626;
        box-shadow: inset 0 0 0 1px #8fa5c4;
    }

    .entry {
        display: flex;
        width: 100%;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 6px;
    }

    .entry:hover {
        background: rgb(13 22 38 / 0.07);
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
        color: #45577a;
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #8fa5c4;
    }
</style>
