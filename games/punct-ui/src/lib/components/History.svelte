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
            <span class="mt-[2px] shrink-0">
                <span
                    class="player-dot"
                    class:dark={session.gameState.getPlayerState(entry.playerId).color ===
                        Color.Black}
                ></span>
            </span>
            <span class="text-left text-[15px] leading-snug">
                <HistoryEntryLine {entry} />
            </span>
        </button>
    {:else}
        <div class="p-3 text-center italic text-(--punct-ink-quiet)">No moves yet</div>
    {/each}
</div>

<style>
    /* Light like the player panels, so black pieces show as well as white. */
    .history {
        background: var(--punct-card);
        color: var(--punct-card-ink);
        box-shadow: inset 0 0 0 1px var(--punct-card-edge);
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

    /* Each player's mark: the round PÜNCT-piece in their colour. */
    .player-dot {
        display: block;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #e2e6ec;
        box-shadow:
            inset 0 0 0 1px #8e95a1,
            inset 0 0 0 4px #e2e6ec,
            inset 0 0 0 7px #fbfbf9;
    }

    .player-dot.dark {
        background: #2c3034;
        box-shadow:
            inset 0 0 0 1px #0b0c0d,
            inset 0 0 0 4px #2c3034,
            inset 0 0 0 7px #111315;
    }

    .divider {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 6px 4px 10px;
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--punct-card-quiet);
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--punct-card-edge);
    }
</style>
