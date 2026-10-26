<script lang="ts">
    import { onDestroy, tick } from 'svelte'
    import { fade } from 'svelte/transition'
    import { quartIn } from 'svelte/easing'
    import { createTimeAgo } from '@tabletop/frontend-components'
    import HistoryTurnCard from '$lib/components/HistoryTurnCard.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries, type HistoryEntry, type HistoryTurn } from '$lib/utils/historyTurns.js'
    import { PanelPalette } from '$lib/utils/playerPanel.js'

    const timeAgo = createTimeAgo()

    let gameSession = getGameSession()
    onDestroy(() => gameSession.highlightHistory(undefined))

    let liveEntries = $derived(
        historyEntries(
            gameSession.actions,
            gameSession.gameState.turnManager.turnOrder,
            gameSession.gameState.finalRound,
            gameSession.gameState.auction
        )
    )

    // A replay steps the shown actions back and forward again, so the list holds still meanwhile.
    // A hotseat viewer follows the active seat, so who reads as "you" holds still too.
    let replay = $state.raw<
        { turnId: string; entries: HistoryEntry[]; viewerId: string | undefined } | undefined
    >(undefined)
    let entries = $derived(replay?.entries ?? liveEntries)
    let viewerId = $derived(replay ? replay.viewerId : gameSession.myPlayer?.id)
    let scroller: HTMLDivElement | undefined = $state()

    async function replayTurn(turn: HistoryTurn) {
        if (replay) return
        const scrollTop = scroller?.scrollTop ?? 0
        replay = { turnId: turn.id, entries: liveEntries, viewerId: gameSession.myPlayer?.id }
        try {
            await gameSession.history.replayRange(turn.firstIndex, turn.lastIndex)
        } finally {
            replay = undefined
            await tick()
            scroller?.scrollTo({ top: scrollTop })
        }
    }

    // A turn is dated by its latest action.
    function when(turn: HistoryTurn): string {
        const at = turn.actions.findLast((action) => action.createdAt)?.createdAt
        return at ? timeAgo.format(at) : ''
    }
</script>

<div
    class="history-panel h-full min-h-[300px] w-full overflow-hidden rounded-lg"
    style:--night={PanelPalette.night}
    style:--trim={PanelPalette.trim}
>
    <div class="h-full w-full overflow-auto px-2 pb-2.5" bind:this={scroller}>
        {#if gameSession.game.finishedAt && !gameSession.isViewingHistory}
            <div class="divider marracash-merchant">Game over</div>
        {/if}
        {#each entries as entry (entry.id)}
            {#if entry.kind === 'round'}
                <div
                    class="divider marracash-merchant"
                    in:fade={{ duration: 200, easing: quartIn }}
                >
                    {entry.final ? 'Final round' : `Round ${entry.round}`}
                </div>
            {:else}
                <div class="mb-2" in:fade={{ duration: 200, easing: quartIn }}>
                    <HistoryTurnCard
                        turn={entry}
                        when={when(entry)}
                        {viewerId}
                        replaying={replay?.turnId === entry.id}
                        onReplay={() => replayTurn(entry)}
                    />
                </div>
            {/if}
        {/each}
    </div>
</div>

<style>
    .history-panel {
        background: var(--night);
        box-shadow: inset 0 0 0 1px var(--trim);
    }

    .divider {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 14px 0;
        font-size: 11px;
        line-height: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--trim);
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #2e3666;
    }
</style>
