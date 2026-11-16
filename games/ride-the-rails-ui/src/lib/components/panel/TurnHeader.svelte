<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { decidingPlayerId, roundLabels } from '$lib/model/actionArea.js'
    import RoundTickets from './RoundTickets.svelte'
    import SeatDot from './SeatDot.svelte'
    import TranscontinentalChip from './TranscontinentalChip.svelte'

    const gameSession = getGameSession()

    const deciderId = $derived(decidingPlayerId(gameSession.gameState))
    const labels = $derived(roundLabels(gameSession.gameState))
    const canUndo = $derived(
        gameSession.hasLocalSelection || gameSession.undoableAction !== undefined
    )

    // docs/game-ui-layout.md, Turn header
    const whose = $derived.by(() => {
        if (gameSession.isViewingHistory) {
            return 'History'
        }
        if (gameSession.gameState.result) {
            return 'End of game'
        }
        if (gameSession.isMyTurn || !deciderId) {
            return 'Your turn'
        }
        return `${gameSession.getPlayerName(deciderId)}'s turn`
    })
    const showsSeat = $derived(
        !gameSession.isViewingHistory && !gameSession.gameState.result && deciderId !== undefined
    )
</script>

<div class="flex h-11 items-center justify-between gap-3 px-3 text-rtr-ink max-sm:h-9 max-sm:px-2">
    <div class="flex min-w-0 items-baseline gap-3 max-sm:gap-1.5">
        <span class="flex items-center gap-2 text-lg font-bold max-sm:gap-1.5 max-sm:text-base">
            {#if showsSeat && deciderId}<SeatDot playerId={deciderId} />{/if}
            {whose}
        </span>
        {#if labels}
            <span class="text-sm text-rtr-ink-muted max-sm:hidden">{labels.full}</span>
            <span class="text-sm text-rtr-ink-muted sm:hidden">{labels.compact}</span>
        {/if}
    </div>
    <div class="flex shrink-0 items-center gap-3 max-sm:gap-1.5">
        <RoundTickets />
        <TranscontinentalChip />
        <button
            type="button"
            class="rounded-full border-2 border-rtr-pill bg-transparent px-3 py-0.5 text-sm font-semibold text-rtr-pill hover:enabled:bg-rtr-panel-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rtr-accent max-sm:px-2"
            class:invisible={!canUndo}
            disabled={!canUndo}
            onclick={() => gameSession.undo()}>Undo</button
        >
    </div>
</div>
