<script lang="ts">
    import { fade } from 'svelte/transition'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { historyEntries, type HistoryEntry } from '$lib/history/historyEntries.js'
    import { BuildingStyle, BuildingType } from '@tabletop/urbino'
    import PieceIcon from './PieceIcon.svelte'
    import { isDarkColor } from '$lib/theme.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    // A replay steps the shown actions back and forward again, so the list holds still meanwhile.
    let replaying = $state.raw<{ entryId: string; entries: HistoryEntry[] } | undefined>(undefined)
    const liveEntries = $derived(historyEntries(session.actions))
    const entries = $derived((replaying?.entries ?? liveEntries).toReversed())
    const firstTurnIndex = $derived(entries.findLastIndex((entry) => entry.kind === 'turn'))

    function replayable(entry: HistoryEntry): boolean {
        return entry.kind !== 'firstPlayer'
    }

    async function replay(entry: HistoryEntry) {
        if (replaying || !replayable(entry)) return
        replaying = { entryId: entry.id, entries: liveEntries }
        try {
            const [first, last] =
                entry.kind === 'turn' ? [entry.firstIndex, entry.lastIndex] : [entry.actionIndex, entry.actionIndex]
            await session.history.replayRange(first, last)
        } finally {
            replaying = undefined
        }
    }
</script>

<div class="h-full min-h-[300px] w-full overflow-auto rounded-lg bg-(--slate-panel) p-2 shadow-[inset_0_0_0_1px_var(--slate-edge)]">
    {#if session.gameState.result && !session.isViewingHistory}
        <div class="divider urbino-display">Game over</div>
    {/if}
    {#each entries as entry, index (entry.id)}
        {#if index === firstTurnIndex + 1 && firstTurnIndex >= 0}
            <div class="divider urbino-display">Setup</div>
        {/if}
        <button
            type="button"
            class="entry"
            class:replaying={replaying?.entryId === entry.id}
            class:light-entry={isDarkColor(session.colors.getPlayerUiColor(entry.playerId))}
            disabled={!replayable(entry)}
            title={replayable(entry) ? 'Replay on the board' : undefined}
            onclick={() => replay(entry)}
            in:fade={{ duration: 200 }}
        >
            <span class="mt-0.5">
                <PieceIcon
                    buildingType={BuildingType.Tower}
                    color={session.colors.getPlayerUiColor(entry.playerId)}
                    buildingStyle={BuildingStyle.TowerRoofs}
                    size={18}
                />
            </span>
            <span class="text-left text-[16px] leading-snug">
                <HistoryEntryLine {entry} viewerId={session.myPlayer?.id} />
            </span>
        </button>
    {:else}
        <div class="p-3 text-center italic text-(--cream-quiet)">No moves yet</div>
    {/each}
</div>

<style>
    .entry {
        display: flex;
        width: 100%;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 6px;
        color: var(--cream);
    }

    .entry:not(:disabled):hover {
        background: rgb(255 255 255 / 0.06);
    }

    .entry.light-entry {
        margin: 2px 0;
        background: var(--maple-plank);
        color: var(--ink);
        box-shadow: inset 0 0 0 1px var(--maple-edge);
    }

    .entry.light-entry:not(:disabled):hover {
        background: var(--maple-light);
    }

    .entry.replaying {
        background: color-mix(in oklab, var(--gold) 22%, transparent);
    }

    .divider {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 10px 4px;
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--cream-quiet);
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--slate-edge);
    }
</style>
